from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.employers.models import Company
from apps.jobs.models import Job
from apps.jobs.services import job_is_publicly_available, lifecycle_local_date

from ..models import (
    JobServiceActivation,
    JobServiceActivationItem,
    ServiceAuditEvent,
    ServiceEntitlementUnit,
    ServicePackageVersion,
)

MAX_GRANT_UNITS = 1000


def package_version_snapshot(version):
    items = version.items.select_related('capability').order_by('order', 'id')
    return {
        'package': {
            'slug': version.package.slug,
            'name_vi': version.package.name_vi,
        },
        'version_number': version.version_number,
        'price': str(version.price),
        'currency': version.currency,
        'activate_within_days': version.activate_within_days,
        'terms_vi': version.terms_vi,
        'items': [
            {
                'capability': item.capability.code,
                'quantity': item.quantity,
                'duration_days': item.duration_days,
                'configuration': item.configuration,
            }
            for item in items
        ],
    }


def record_service_audit_event(
    *,
    event_type,
    actor=None,
    company=None,
    package_version=None,
    unit=None,
    activation=None,
    metadata=None,
    occurred_at=None,
):
    return ServiceAuditEvent.objects.create(
        event_type=event_type,
        actor=actor,
        company=company,
        package_version=package_version,
        unit=unit,
        activation=activation,
        metadata=metadata or {},
        occurred_at=occurred_at or timezone.now(),
    )


@transaction.atomic
def grant_package_units(
    *,
    company,
    package_version,
    quantity,
    actor,
    grant_key,
    source=ServiceEntitlementUnit.Source.MANUAL_GRANT,
    granted_at=None,
):
    grant_key = str(grant_key or '').strip()
    if not grant_key:
        raise ValidationError({'grant_key': 'Cần khóa chống cấp trùng.'})
    if not 1 <= quantity <= MAX_GRANT_UNITS:
        raise ValidationError({'quantity': f'Số lượt phải từ 1 đến {MAX_GRANT_UNITS}.'})

    locked_company = Company.objects.select_for_update().get(pk=company.pk)
    existing = list(
        ServiceEntitlementUnit.objects.filter(
            company=locked_company,
            grant_key=grant_key,
        ).order_by('unit_number')
    )
    if existing:
        if len(existing) != quantity or any(
            unit.package_version_id != package_version.pk or unit.source != source
            for unit in existing
        ):
            raise ValidationError({'grant_key': 'Khóa cấp lượt đã được dùng với dữ liệu khác.'})
        return existing

    version = (
        ServicePackageVersion.objects.select_for_update()
        .select_related('package')
        .get(pk=package_version.pk)
    )
    if version.status != ServicePackageVersion.Status.PUBLISHED:
        raise ValidationError('Chỉ có thể cấp lượt từ phiên bản đang phát hành.')
    if not version.items.exists():
        raise ValidationError('Phiên bản gói chưa có quyền lợi.')

    granted_at = granted_at or timezone.now()
    activate_by = granted_at + timedelta(days=version.activate_within_days)
    snapshot = package_version_snapshot(version)
    units = []
    for unit_number in range(1, quantity + 1):
        unit = ServiceEntitlementUnit.objects.create(
            company=locked_company,
            package_version=version,
            source=source,
            grant_key=grant_key,
            unit_number=unit_number,
            snapshot=snapshot,
            granted_at=granted_at,
            activate_by=activate_by,
            created_by=actor,
        )
        record_service_audit_event(
            event_type=ServiceAuditEvent.EventType.UNIT_GRANTED,
            actor=actor,
            company=locked_company,
            package_version=version,
            unit=unit,
            metadata={'source': source, 'grant_key': grant_key},
            occurred_at=granted_at,
        )
        units.append(unit)
    return units


@transaction.atomic
def revoke_entitlement_unit(*, unit, actor, reason):
    reason = str(reason or '').strip()
    if not reason:
        raise ValidationError({'reason': 'Cần ghi rõ lý do thu hồi.'})
    locked_unit = ServiceEntitlementUnit.objects.select_for_update().get(pk=unit.pk)
    if locked_unit.status != ServiceEntitlementUnit.Status.AVAILABLE:
        raise ValidationError('Chỉ có thể thu hồi lượt chưa sử dụng.')

    now = timezone.now()
    locked_unit.status = ServiceEntitlementUnit.Status.REVOKED
    locked_unit.revoked_at = now
    locked_unit.revoke_reason = reason
    locked_unit.save(update_fields=['status', 'revoked_at', 'revoke_reason', 'updated_at'])
    record_service_audit_event(
        event_type=ServiceAuditEvent.EventType.UNIT_REVOKED,
        actor=actor,
        company=locked_unit.company,
        package_version=locked_unit.package_version,
        unit=locked_unit,
        metadata={'reason': reason},
        occurred_at=now,
    )
    return locked_unit


def _validate_actor_company(*, actor, company_id):
    if getattr(actor, 'role', '') == 'admin' or getattr(actor, 'is_superuser', False):
        return
    recruiter_profile = getattr(actor, 'recruiter_profile', None)
    if recruiter_profile is None or recruiter_profile.company_id != company_id:
        raise ValidationError('Bạn không có quyền kích hoạt dịch vụ của doanh nghiệp này.')


@transaction.atomic
def activate_job_service(
    *,
    unit,
    job,
    actor,
    idempotency_key,
    activated_at=None,
):
    idempotency_key = str(idempotency_key or '').strip()
    if not idempotency_key:
        raise ValidationError({'idempotency_key': 'Thiếu khóa chống kích hoạt trùng.'})

    company = Company.objects.select_for_update().get(pk=unit.company_id)
    _validate_actor_company(actor=actor, company_id=company.pk)
    existing = JobServiceActivation.objects.filter(
        company=company,
        idempotency_key=idempotency_key,
    ).first()
    if existing:
        if existing.unit_id != unit.pk or existing.job_id != job.pk:
            raise ValidationError(
                {'idempotency_key': 'Khóa kích hoạt đã được dùng cho yêu cầu khác.'}
            )
        return existing

    locked_unit = (
        ServiceEntitlementUnit.objects.select_for_update()
        .select_related('company', 'package_version__package')
        .get(pk=unit.pk)
    )
    locked_job = (
        Job.objects.select_for_update(of=('self',)).select_related('campaign').get(pk=job.pk)
    )
    if locked_unit.company_id != company.pk or locked_job.company_id != company.pk:
        raise ValidationError('Lượt dịch vụ và tin tuyển dụng không cùng doanh nghiệp.')
    if locked_unit.status != ServiceEntitlementUnit.Status.AVAILABLE:
        raise ValidationError('Lượt dịch vụ không còn khả dụng.')

    starts_at = activated_at or timezone.now()
    if starts_at > locked_unit.activate_by:
        raise ValidationError('Lượt dịch vụ đã quá hạn bắt đầu sử dụng.')
    if not job_is_publicly_available(job_id=locked_job.pk):
        raise ValidationError('Chỉ có thể kích hoạt trên tin đang công khai và không bị hold.')

    version_items = list(
        locked_unit.package_version.items.select_related('capability').order_by('order', 'id')
    )
    if not version_items:
        raise ValidationError('Lượt dịch vụ không có quyền lợi để kích hoạt.')
    item_windows = [
        (
            item,
            starts_at + timedelta(days=item.duration_days)
            if item.duration_days is not None
            else starts_at,
        )
        for item in version_items
    ]
    ends_at = max(end for _, end in item_windows)

    if locked_job.visibility_ends_at is None or locked_job.visibility_ends_at < ends_at:
        raise ValidationError(
            'Tin không còn đủ thời gian công khai cho toàn bộ dịch vụ. '
            'Vui lòng gia hạn tin trước khi kích hoạt.'
        )
    service_end_date = lifecycle_local_date(ends_at)
    if locked_job.deadline is None or locked_job.deadline < service_end_date:
        raise ValidationError(
            'Hạn nhận hồ sơ chưa đủ cho toàn bộ dịch vụ. Vui lòng xác nhận gia hạn trước.'
        )
    if (
        locked_job.campaign_id
        and locked_job.campaign.target_date
        and locked_job.campaign.target_date < service_end_date
    ):
        raise ValidationError('Dịch vụ sẽ vượt ngày kết thúc chiến dịch tuyển dụng.')

    activation = JobServiceActivation.objects.create(
        unit=locked_unit,
        company=company,
        job=locked_job,
        idempotency_key=idempotency_key,
        starts_at=starts_at,
        ends_at=ends_at,
        snapshot=locked_unit.snapshot,
        created_by=actor,
    )
    JobServiceActivationItem.objects.bulk_create(
        [
            JobServiceActivationItem(
                activation=activation,
                capability=item.capability,
                total_quantity=item.quantity,
                remaining_quantity=item.quantity,
                starts_at=starts_at,
                ends_at=item_ends_at,
                configuration=item.configuration,
            )
            for item, item_ends_at in item_windows
        ]
    )
    locked_unit.status = ServiceEntitlementUnit.Status.CONSUMED
    locked_unit.consumed_at = starts_at
    locked_unit.save(update_fields=['status', 'consumed_at', 'updated_at'])
    record_service_audit_event(
        event_type=ServiceAuditEvent.EventType.UNIT_CONSUMED,
        actor=actor,
        company=company,
        package_version=locked_unit.package_version,
        unit=locked_unit,
        activation=activation,
        metadata={'job_public_id': locked_job.public_id},
        occurred_at=starts_at,
    )
    record_service_audit_event(
        event_type=ServiceAuditEvent.EventType.ACTIVATION_CREATED,
        actor=actor,
        company=company,
        package_version=locked_unit.package_version,
        unit=locked_unit,
        activation=activation,
        metadata={
            'job_public_id': locked_job.public_id,
            'starts_at': starts_at.isoformat(),
            'ends_at': ends_at.isoformat(),
        },
        occurred_at=starts_at,
    )
    return activation


@transaction.atomic
def expire_due_entitlement_units(*, at=None, batch_size=500):
    at = at or timezone.now()
    units = list(
        ServiceEntitlementUnit.objects.select_for_update(skip_locked=True)
        .select_related('company', 'package_version')
        .filter(
            status=ServiceEntitlementUnit.Status.AVAILABLE,
            activate_by__lt=at,
        )[:batch_size]
    )
    for unit in units:
        unit.status = ServiceEntitlementUnit.Status.EXPIRED
        unit.expired_at = at
        unit.save(update_fields=['status', 'expired_at', 'updated_at'])
        record_service_audit_event(
            event_type=ServiceAuditEvent.EventType.UNIT_EXPIRED,
            company=unit.company,
            package_version=unit.package_version,
            unit=unit,
            occurred_at=at,
        )
    return len(units)


@transaction.atomic
def expire_due_job_service_activations(*, at=None, batch_size=500):
    at = at or timezone.now()
    activations = list(
        JobServiceActivation.objects.select_for_update(skip_locked=True)
        .select_related('company', 'unit__package_version')
        .filter(status=JobServiceActivation.Status.ACTIVE, ends_at__lte=at)[:batch_size]
    )
    for activation in activations:
        activation.status = JobServiceActivation.Status.EXPIRED
        activation.save(update_fields=['status', 'updated_at'])
        record_service_audit_event(
            event_type=ServiceAuditEvent.EventType.ACTIVATION_EXPIRED,
            company=activation.company,
            package_version=activation.unit.package_version,
            unit=activation.unit,
            activation=activation,
            occurred_at=at,
        )
    return len(activations)

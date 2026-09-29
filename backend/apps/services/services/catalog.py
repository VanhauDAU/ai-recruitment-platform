from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from ..models import ServicePackage, ServicePackageVersion, ServicePackageVersionItem


@transaction.atomic
def create_package_version(
    *,
    package: ServicePackage,
    price,
    currency='VND',
    activate_within_days=90,
    terms_vi='',
    terms_en='',
):
    locked_package = ServicePackage.objects.select_for_update().get(pk=package.pk)
    latest_number = (
        ServicePackageVersion.objects.filter(package=locked_package).aggregate(
            latest=Max('version_number')
        )['latest']
        or 0
    )
    return ServicePackageVersion.objects.create(
        package=locked_package,
        version_number=latest_number + 1,
        price=price,
        currency=currency,
        activate_within_days=activate_within_days,
        terms_vi=terms_vi,
        terms_en=terms_en,
    )


@transaction.atomic
def create_package_version_draft(*, package, values, items):
    version = create_package_version(
        package=package,
        price=values['price'],
        currency=values.get('currency', 'VND'),
        activate_within_days=values.get('activate_within_days', 90),
        terms_vi=values.get('terms_vi', ''),
        terms_en=values.get('terms_en', ''),
    )
    return save_package_version_draft(
        package_version=version,
        values=values,
        items=items,
    )


@transaction.atomic
def publish_package_version(*, package_version: ServicePackageVersion, actor=None):
    version = (
        ServicePackageVersion.objects.select_for_update()
        .select_related('package')
        .get(pk=package_version.pk)
    )
    ServicePackage.objects.select_for_update().get(pk=version.package_id)

    if version.status != ServicePackageVersion.Status.DRAFT:
        raise ValidationError('Chỉ có thể phát hành một phiên bản nháp.')
    items = list(version.items.select_related('capability').order_by('order', 'id'))
    if not items:
        raise ValidationError('Gói phải có ít nhất một quyền lợi có cấu trúc.')
    if inactive_codes := [item.capability.code for item in items if not item.capability.is_active]:
        raise ValidationError(
            'Không thể phát hành quyền lợi đang tắt: ' + ', '.join(inactive_codes)
        )

    ServicePackageVersion.objects.filter(
        package_id=version.package_id,
        status=ServicePackageVersion.Status.PUBLISHED,
    ).update(status=ServicePackageVersion.Status.ARCHIVED, updated_at=timezone.now())
    version.status = ServicePackageVersion.Status.PUBLISHED
    version.published_at = timezone.now()
    version.save(update_fields=['status', 'published_at', 'updated_at'])
    from .entitlements import record_service_audit_event

    record_service_audit_event(
        event_type='package_published',
        actor=actor,
        package_version=version,
        metadata={'package_slug': version.package.slug, 'version': version.version_number},
        occurred_at=version.published_at,
    )
    return version


@transaction.atomic
def add_package_version_item(
    *,
    package_version: ServicePackageVersion,
    capability,
    quantity=1,
    duration_days=None,
    configuration=None,
    order=0,
):
    version = ServicePackageVersion.objects.select_for_update().get(pk=package_version.pk)
    if version.status != ServicePackageVersion.Status.DRAFT:
        raise ValidationError('Chỉ có thể sửa quyền lợi của phiên bản nháp.')
    return ServicePackageVersionItem.objects.create(
        package_version=version,
        capability=capability,
        quantity=quantity,
        duration_days=duration_days,
        configuration=configuration or {},
        order=order,
    )


@transaction.atomic
def save_package_version_draft(*, package_version, values, items):
    version = (
        ServicePackageVersion.objects.select_for_update()
        .select_related('package')
        .get(pk=package_version.pk)
    )
    if version.status != ServicePackageVersion.Status.DRAFT:
        raise ValidationError('Chỉ có thể sửa phiên bản nháp.')

    for field in (
        'price',
        'currency',
        'activate_within_days',
        'terms_vi',
        'terms_en',
    ):
        if field in values:
            setattr(version, field, values[field])
    version.save()
    version.items.all().delete()
    for order, item in enumerate(items):
        add_package_version_item(
            package_version=version,
            capability=item['capability'],
            quantity=item.get('quantity', 1),
            duration_days=item.get('duration_days'),
            configuration=item.get('configuration', {}),
            order=item.get('order', order),
        )
    return version

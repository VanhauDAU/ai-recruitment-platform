"""Company mutation and review workflows."""

import re

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.services import StaleImpactToken, record_admin_action
from common.media_storage import delete_local_media_url
from common.rich_text import rich_text_plain_text, sanitize_rich_text

from ..models import (
    CompanyDocument,
    CompanyImage,
    CompanyIndustry,
    CompanyMediaUpload,
    CompanyUpdateEvent,
    CompanyUpdateRequest,
    CompanyUpdateRevision,
    Industry,
)
from .company_update_locks import lock_company_update_request

UPDATABLE_COMPANY_FIELDS = {
    'business_type',
    'tax_code',
    'company_name',
    'trade_name',
    'trade_name_same_as_registered',
    'has_no_logo',
    'website_url',
    'has_no_website',
    'email',
    'phone',
    'address',
    'company_size',
    'description',
    'employee_benefits',
    'markets',
    'target_customers',
    'founded_year',
}
SENSITIVE_FIELDS = {'tax_code', 'company_name'}
ACTIVE_COMPANY_UPDATE_STATUSES = frozenset(
    {
        CompanyUpdateRequest.Status.PENDING,
        CompanyUpdateRequest.Status.SUBMITTED,
        CompanyUpdateRequest.Status.IN_REVIEW,
        CompanyUpdateRequest.Status.CHANGES_REQUESTED,
    }
)
REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES = frozenset(
    {
        CompanyUpdateRequest.Status.PENDING,
        CompanyUpdateRequest.Status.SUBMITTED,
        CompanyUpdateRequest.Status.CHANGES_REQUESTED,
    }
)
COMPANY_DESCRIPTION_MIN_LENGTH = 500
PRE_REVIEW_COMPANY_UPDATE_STATUSES = frozenset(
    {
        CompanyUpdateRequest.Status.PENDING,
        CompanyUpdateRequest.Status.SUBMITTED,
        CompanyUpdateRequest.Status.CHANGES_REQUESTED,
    }
)


class CompanyUpdateConflict(Exception):
    """One or more requested fields changed after the requester snapshot."""

    def __init__(self, fields):
        self.fields = tuple(sorted(set(fields)))
        super().__init__('Thông tin công ty đã thay đổi ở các trường đang được yêu cầu cập nhật.')


def _company_update_field_value(company, field):
    if field == 'industries':
        return list(
            company.company_industries.order_by('industry_id').values_list(
                'industry_id',
                flat=True,
            )
        )
    if field == 'primary_industry':
        return (
            company.company_industries.filter(is_primary=True)
            .values_list('industry_id', flat=True)
            .first()
        )
    if field in {'gallery_additions', 'gallery_deletions'}:
        return list(company.images.order_by('id').values_list('id', flat=True))
    if field.endswith('_pending'):
        return None
    return getattr(company, field, None)


def capture_company_update_base_values(company, changes):
    return {
        field: _company_update_field_value(company, field)
        for field in changes
        if not field.endswith('_pending')
    }


def _current_request_media(update_request):
    changes = update_request.changes or {}
    paths = {
        value
        for value in (
            changes.get('logo_url'),
            changes.get('cover_image_url'),
            *(changes.get('gallery_additions') or []),
        )
        if value
    }
    if not paths:
        return CompanyMediaUpload.objects.none()
    return update_request.media_upload_records.filter(public_path__in=paths)


def snapshot_company_update_request(
    update_request,
    *,
    actor,
    event_type=CompanyUpdateEvent.EventType.REVISION_CREATED,
    base_company_updated_at=None,
    base_values=None,
    payload=None,
):
    """Append one immutable snapshot after the caller locks Company → Request."""
    has_revision = update_request.revisions.exists()
    number = update_request.revision + 1 if has_revision else max(update_request.revision, 1)
    update_request.revision = number
    if base_company_updated_at is not None:
        update_request.base_company_updated_at = base_company_updated_at
    if base_values is not None:
        update_request.base_values = base_values
    update_request.lock_version += 1
    update_request.save(
        update_fields=[
            'revision',
            'base_company_updated_at',
            'base_values',
            'lock_version',
            'updated_at',
        ]
    )
    revision = CompanyUpdateRevision.objects.create(
        update_request=update_request,
        number=number,
        submitted_by=actor,
        changes=update_request.changes,
        reason=update_request.reason,
        proof_type=update_request.proof_type,
        base_company_updated_at=(
            update_request.base_company_updated_at or update_request.company.updated_at
        ),
        base_values=update_request.base_values,
        submitted_at=update_request.submitted_at,
    )
    update_request.current_revision = revision
    update_request.save(update_fields=['current_revision', 'updated_at'])
    current_documents = update_request.documents.filter(is_current=True)
    current_media = _current_request_media(update_request)
    revision.documents.set(current_documents)
    revision.media_uploads.set(current_media)
    current_documents.update(update_revision=revision)
    current_media.update(update_revision=revision)
    CompanyUpdateEvent.objects.create(
        update_request=update_request,
        actor=actor,
        event_type=event_type,
        revision_number=number,
        payload={
            'changed_fields': sorted((update_request.changes or {}).keys()),
            **(payload or {}),
        },
    )
    return revision


def current_company_update_revision(update_request):
    revision = update_request.current_revision
    if revision is not None and revision.number == update_request.revision:
        return revision
    return update_request.revisions.filter(number=update_request.revision).first()


def validate_company_update_revision(update_request, revision_public_id=''):
    revision = current_company_update_revision(update_request)
    if revision is None and not revision_public_id:
        revision = snapshot_company_update_request(
            update_request,
            actor=update_request.requested_by,
            base_company_updated_at=(
                update_request.base_company_updated_at or update_request.company.updated_at
            ),
            base_values=(
                update_request.base_values
                or capture_company_update_base_values(
                    update_request.company,
                    update_request.changes,
                )
            ),
            payload={'compatibility_snapshot': True},
        )
    if revision is None:
        raise StaleImpactToken('Yêu cầu chưa có revision hiện hành. Vui lòng tải lại.')
    if revision_public_id and revision.public_id != revision_public_id:
        raise StaleImpactToken('Phiên yêu cầu đã thay đổi. Vui lòng tải lại.')
    return revision


def _request_review_blockers(update_request):
    changes = update_request.changes or {}
    blockers = []
    if {'logo_pending', 'cover_pending', 'gallery_pending'} & set(changes):
        blockers.append('media_upload_pending')
    if update_request.is_sensitive:
        current_types = set(
            update_request.documents.filter(is_current=True).values_list('doc_type', flat=True)
        )
        if update_request.proof_type == update_request.ProofType.BUSINESS_REGISTRATION:
            complete = CompanyDocument.DocType.BUSINESS_REGISTRATION in current_types
        else:
            complete = {
                CompanyDocument.DocType.AUTHORIZATION_LETTER,
                CompanyDocument.DocType.IDENTITY_DOCUMENT,
            }.issubset(current_types)
        if not complete:
            blockers.append('supporting_documents_missing')
    return blockers


@transaction.atomic
def start_company_update_review(
    update_request,
    *,
    actor,
    lock_version,
    revision_public_id='',
):
    _, update_request = lock_company_update_request(
        company_id=update_request.company_id,
        update_request_id=update_request.pk,
    )
    if update_request.lock_version != lock_version:
        raise StaleImpactToken('Yêu cầu đã thay đổi. Vui lòng tải lại.')
    validate_company_update_revision(update_request, revision_public_id)
    if update_request.status not in {
        CompanyUpdateRequest.Status.PENDING,
        CompanyUpdateRequest.Status.SUBMITTED,
    }:
        raise ValidationError({'detail': 'Chỉ yêu cầu đã gửi mới được nhận thẩm định.'})
    blockers = _request_review_blockers(update_request)
    if blockers:
        raise ValidationError(
            {
                'code': 'COMPANY_UPDATE_NOT_READY',
                'detail': 'Yêu cầu chưa đủ dữ liệu để bắt đầu thẩm định.',
                'blockers': blockers,
            }
        )
    update_request.status = CompanyUpdateRequest.Status.IN_REVIEW
    update_request.reviewed_by = actor
    update_request.reviewed_at = None
    update_request.review_note = ''
    update_request.lock_version += 1
    update_request.save(
        update_fields=[
            'status',
            'reviewed_by',
            'reviewed_at',
            'review_note',
            'lock_version',
            'updated_at',
        ]
    )
    CompanyUpdateEvent.objects.create(
        update_request=update_request,
        actor=actor,
        event_type=CompanyUpdateEvent.EventType.REVIEW_STARTED,
        revision_number=update_request.revision,
    )
    return update_request


@transaction.atomic
def close_company_update_before_review(
    update_request,
    *,
    actor,
    action,
    reason,
    lock_version,
    actor_is_owner=False,
):
    _, update_request = lock_company_update_request(
        company_id=update_request.company_id,
        update_request_id=update_request.pk,
    )
    if update_request.lock_version != lock_version:
        raise StaleImpactToken('Yêu cầu đã thay đổi. Vui lòng tải lại.')
    if update_request.status not in PRE_REVIEW_COMPANY_UPDATE_STATUSES:
        raise ValidationError({'detail': 'Yêu cầu đã vào thẩm định hoặc đã kết thúc.'})
    if action == CompanyUpdateRequest.Status.WITHDRAWN:
        if update_request.requested_by_id != actor.id:
            raise ValidationError({'detail': 'Chỉ người tạo yêu cầu mới được rút yêu cầu.'})
        event_type = CompanyUpdateEvent.EventType.WITHDRAWN
    elif action == CompanyUpdateRequest.Status.CANCELLED:
        if not actor_is_owner:
            raise ValidationError({'detail': 'Chỉ chủ công ty mới được hủy yêu cầu.'})
        if not reason.strip():
            raise ValidationError({'reason': 'Nhập lý do hủy yêu cầu.'})
        event_type = CompanyUpdateEvent.EventType.CANCELLED
    else:
        raise ValidationError({'action': 'Thao tác không hợp lệ.'})
    update_request.status = action
    update_request.review_note = reason.strip()
    update_request.reviewed_by = actor
    update_request.reviewed_at = timezone.now()
    update_request.lock_version += 1
    update_request.save(
        update_fields=[
            'status',
            'review_note',
            'reviewed_by',
            'reviewed_at',
            'lock_version',
            'updated_at',
        ]
    )
    CompanyUpdateEvent.objects.create(
        update_request=update_request,
        actor=actor,
        event_type=event_type,
        revision_number=update_request.revision,
        payload={'reason': reason.strip()},
    )
    return update_request


def company_update_conflicting_fields(company, revision):
    return [
        field
        for field, base_value in (revision.base_values or {}).items()
        if _company_update_field_value(company, field) != base_value
    ]


def normalize_company_tax_code(value):
    """Return the canonical Vietnamese 10/13-digit tax identifier."""

    normalized = str(value or '').strip()
    if not re.fullmatch(r'(?:[0-9]{10}|[0-9]{13})', normalized):
        raise ValueError('Mã số thuế phải gồm đúng 10 hoặc 13 chữ số.')
    return normalized


def normalize_company_rich_text(value, *, required, label):
    """Sanitize and validate rich text using its visible-text length."""

    if not isinstance(value, str):
        raise ValueError(f'{label} không hợp lệ.')
    sanitized = sanitize_rich_text(value)
    visible = rich_text_plain_text(sanitized)
    if required and not visible:
        raise ValueError(f'{label} là bắt buộc.')
    if required and len(visible) < COMPANY_DESCRIPTION_MIN_LENGTH:
        raise ValueError(f'{label} phải có ít nhất {COMPANY_DESCRIPTION_MIN_LENGTH} ký tự.')
    if len(visible) > 10_000:
        raise ValueError(f'{label} không được vượt quá 10.000 ký tự.')
    return sanitized


@transaction.atomic
def set_company_industries(company, industries, primary_industry):
    """Replace a company's industry assignments atomically."""
    company.company_industries.all().delete()
    CompanyIndustry.objects.bulk_create(
        [
            CompanyIndustry(
                company=company,
                industry=industry,
                is_primary=industry == primary_industry,
            )
            for industry in industries
        ]
    )


@transaction.atomic
def apply_update_request(
    update_request,
    admin_user,
    approve=None,
    note='',
    lock_version=None,
    *,
    decision=None,
    revision_public_id='',
):
    """Review an update request and atomically apply approved changes."""
    company, update_request = lock_company_update_request(
        company_id=update_request.company_id,
        update_request_id=update_request.pk,
    )
    decision = decision or (
        update_request.Status.APPROVED if approve else update_request.Status.REJECTED
    )
    if decision not in {
        update_request.Status.APPROVED,
        update_request.Status.CHANGES_REQUESTED,
        update_request.Status.REJECTED,
    }:
        raise ValidationError({'decision': 'Kết quả xử lý yêu cầu không hợp lệ.'})
    if update_request.status != update_request.Status.IN_REVIEW:
        raise ValidationError({'detail': 'Yêu cầu này đã được xử lý.'})
    if lock_version is not None and update_request.lock_version != lock_version:
        raise StaleImpactToken('Yêu cầu đã được chỉnh sửa. Vui lòng tải lại trước khi duyệt.')
    revision = validate_company_update_revision(update_request, revision_public_id)

    if decision == update_request.Status.APPROVED:
        conflicting_fields = company_update_conflicting_fields(company, revision)
        if conflicting_fields:
            raise CompanyUpdateConflict(conflicting_fields)
        request_markers = {'logo_pending', 'cover_pending', 'gallery_pending'} & set(
            update_request.changes
        )
        if request_markers:
            raise ValidationError({'detail': 'Yêu cầu còn tệp hình ảnh chưa tải lên thành công.'})
        if update_request.is_sensitive:
            approved_document_types = set(
                update_request.documents.filter(
                    is_current=True,
                    status=CompanyDocument.Status.APPROVED,
                ).values_list('doc_type', flat=True)
            )
            if update_request.proof_type == update_request.ProofType.BUSINESS_REGISTRATION:
                complete = CompanyDocument.DocType.BUSINESS_REGISTRATION in approved_document_types
            else:
                complete = {
                    CompanyDocument.DocType.AUTHORIZATION_LETTER,
                    CompanyDocument.DocType.IDENTITY_DOCUMENT,
                }.issubset(approved_document_types)
            if not complete:
                raise ValidationError(
                    {'detail': ('Yêu cầu nhạy cảm chưa có đủ giấy tờ chứng minh đã được duyệt.')}
                )
        changes = dict(update_request.changes)
        if 'tax_code' in changes:
            try:
                changes['tax_code'] = normalize_company_tax_code(changes['tax_code'])
            except ValueError as error:
                raise ValidationError({'tax_code': str(error)}) from error
        for field, required, label in (
            ('description', True, 'Mô tả công ty'),
            ('employee_benefits', False, 'Phúc lợi nhân viên'),
        ):
            if field not in changes:
                continue
            try:
                changes[field] = normalize_company_rich_text(
                    changes[field],
                    required=required,
                    label=label,
                )
            except ValueError as error:
                raise ValidationError({field: str(error)}) from error
        industry_ids = changes.pop('industries', None)
        primary_id = changes.pop('primary_industry', None)
        logo_url = changes.pop('logo_url', None)
        cover_image_url = changes.pop('cover_image_url', None)
        gallery_additions = changes.pop('gallery_additions', [])
        gallery_deletions = changes.pop('gallery_deletions', [])
        changes.pop('logo_pending', None)
        changes.pop('gallery_pending', None)
        old_logo_url = ''
        old_cover_image_url = ''
        if logo_url is not None:
            old_logo_url = company.logo_url
            company.logo_url = logo_url
            company.has_no_logo = not bool(logo_url)
        elif changes.get('has_no_logo'):
            old_logo_url = company.logo_url
            company.logo_url = ''
        if cover_image_url is not None:
            old_cover_image_url = company.cover_image_url
            company.cover_image_url = cover_image_url
        for field, value in changes.items():
            if field in UPDATABLE_COMPANY_FIELDS:
                setattr(company, field, value)
        images_to_delete = list(
            CompanyImage.objects.filter(
                company=company,
                id__in=gallery_deletions,
            )
        )
        final_gallery_count = (
            company.images.count() - len(images_to_delete) + len(gallery_additions)
        )
        if final_gallery_count > 10:
            raise ValidationError({'detail': 'Thư viện công ty chỉ được có tối đa 10 ảnh.'})
        company.save()
        if industry_ids:
            industries = list(Industry.objects.filter(id__in=industry_ids))
            primary = next(
                (industry for industry in industries if industry.id == primary_id),
                industries[0] if industries else None,
            )
            set_company_industries(company, industries, primary)
        deleted_gallery_paths = [image.image_url for image in images_to_delete]
        if images_to_delete:
            CompanyImage.objects.filter(id__in=[image.id for image in images_to_delete]).delete()
        last_order = (
            company.images.order_by('-sort_order').values_list('sort_order', flat=True).first()
        )
        next_order = (last_order + 1) if last_order is not None else 0
        CompanyImage.objects.bulk_create(
            [
                CompanyImage(
                    company=company,
                    image_url=path,
                    sort_order=next_order + index,
                )
                for index, path in enumerate(gallery_additions)
            ]
        )
        paths_to_delete = [
            path for path in [old_logo_url, old_cover_image_url, *deleted_gallery_paths] if path
        ]

        def delete_replaced_media():
            for path in paths_to_delete:
                delete_local_media_url(path)

        transaction.on_commit(delete_replaced_media)

    if decision == update_request.Status.REJECTED:
        staged_paths = [
            update_request.changes.get('logo_url'),
            update_request.changes.get('cover_image_url'),
            *update_request.changes.get('gallery_additions', []),
        ]

        def delete_rejected_media():
            for path in staged_paths:
                if path:
                    delete_local_media_url(path)

        transaction.on_commit(delete_rejected_media)

    update_request.status = decision
    update_request.reviewed_by = admin_user
    update_request.reviewed_at = timezone.now()
    update_request.review_note = note
    update_request.lock_version += 1
    update_request.save(
        update_fields=[
            'status',
            'reviewed_by',
            'reviewed_at',
            'review_note',
            'lock_version',
            'updated_at',
        ]
    )
    record_admin_action(
        actor=admin_user,
        action='review_company_update_request',
        target_type='company_update_request',
        target_public_id=update_request.public_id,
        payload={
            'decision': update_request.status,
            'company_public_id': update_request.company.public_id,
            'tax_lookup_evidence_public_id': (
                update_request.tax_lookup_evidences.filter(
                    workflow_revision=update_request.revision,
                )
                .order_by('-created_at', '-id')
                .values_list('public_id', flat=True)
                .first()
            ),
        },
    )
    CompanyUpdateEvent.objects.create(
        update_request=update_request,
        actor=admin_user,
        event_type={
            update_request.Status.APPROVED: CompanyUpdateEvent.EventType.APPROVED,
            update_request.Status.CHANGES_REQUESTED: (
                CompanyUpdateEvent.EventType.CHANGES_REQUESTED
            ),
            update_request.Status.REJECTED: CompanyUpdateEvent.EventType.REJECTED,
        }[decision],
        revision_number=update_request.revision,
        payload={'note': note.strip()},
    )
    return update_request


@transaction.atomic
def review_company_update_document(
    document,
    *,
    admin_user,
    decision,
    note='',
    lock_version=None,
    revision_public_id='',
):
    """Review one current proof attached to a pending company update."""
    _, update_request = lock_company_update_request(
        company_id=document.company_id,
        update_request_id=document.update_request_id,
    )
    document = CompanyDocument.objects.select_for_update().get(pk=document.pk)
    if document.update_request_id != update_request.pk:
        raise ValidationError({'detail': 'Giấy tờ không còn thuộc yêu cầu cập nhật này.'})
    if update_request.status != update_request.Status.IN_REVIEW:
        raise ValidationError({'detail': 'Yêu cầu cập nhật này đã được xử lý.'})
    if not document.is_current:
        raise ValidationError({'detail': 'Đây không còn là phiên bản giấy tờ hiện tại.'})
    if lock_version is not None and update_request.lock_version != lock_version:
        raise StaleImpactToken('Yêu cầu đã được chỉnh sửa. Vui lòng tải lại trước khi duyệt.')
    validate_company_update_revision(update_request, revision_public_id)
    allowed = {
        CompanyDocument.Status.APPROVED,
        CompanyDocument.Status.CHANGES_REQUESTED,
        CompanyDocument.Status.REJECTED,
    }
    if decision not in allowed:
        raise ValidationError({'decision': 'Kết quả duyệt giấy tờ không hợp lệ.'})
    if decision != CompanyDocument.Status.APPROVED and not note.strip():
        raise ValidationError({'note': 'Nhập lý do khi yêu cầu bổ sung hoặc từ chối.'})

    document.status = decision
    document.reviewed_by = admin_user
    document.reviewed_at = timezone.now()
    document.review_note = note.strip()
    document.save(
        update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at']
    )
    update_request.lock_version += 1
    update_request.save(update_fields=['lock_version', 'updated_at'])
    record_admin_action(
        actor=admin_user,
        action='review_company_update_document',
        target_type='company_update_document',
        target_public_id=document.public_id,
        payload={
            'decision': decision,
            'update_request_public_id': update_request.public_id,
        },
    )
    CompanyUpdateEvent.objects.create(
        update_request=update_request,
        actor=admin_user,
        event_type=CompanyUpdateEvent.EventType.DOCUMENT_REVIEWED,
        revision_number=update_request.revision,
        payload={
            'decision': decision,
            'document_public_id': document.public_id,
        },
    )
    return document, update_request

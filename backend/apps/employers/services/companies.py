"""Company mutation and review workflows."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.services import StaleImpactToken, record_admin_action
from common.media_storage import delete_local_media_url

from ..models import Company, CompanyDocument, CompanyImage, CompanyIndustry, Industry

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
def apply_update_request(update_request, admin_user, approve, note='', lock_version=None):
    """Review an update request and atomically apply approved changes."""
    update_request = type(update_request).objects.select_for_update().get(pk=update_request.pk)
    if update_request.status != update_request.Status.PENDING:
        raise ValidationError({'detail': 'Yêu cầu này đã được xử lý.'})
    if lock_version is not None and update_request.lock_version != lock_version:
        raise StaleImpactToken('Yêu cầu đã được chỉnh sửa. Vui lòng tải lại trước khi duyệt.')

    if approve:
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
        company = update_request.company
        changes = dict(update_request.changes)
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

    if not approve:
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

    update_request.status = (
        update_request.Status.APPROVED if approve else update_request.Status.REJECTED
    )
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
        },
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
):
    """Review one current proof attached to a pending company update."""
    document = CompanyDocument.objects.select_for_update().get(pk=document.pk)
    update_request = (
        type(document.update_request).objects.select_for_update().get(pk=document.update_request_id)
    )
    if update_request.status != update_request.Status.PENDING:
        raise ValidationError({'detail': 'Yêu cầu cập nhật này đã được xử lý.'})
    if not document.is_current:
        raise ValidationError({'detail': 'Đây không còn là phiên bản giấy tờ hiện tại.'})
    if lock_version is not None and update_request.lock_version != lock_version:
        raise StaleImpactToken('Yêu cầu đã được chỉnh sửa. Vui lòng tải lại trước khi duyệt.')
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
    return document, update_request


@transaction.atomic
def verify_company(company, admin_user, approve, reason=''):
    """Review company verification after its documents were inspected."""
    if approve:
        company.verification_status = Company.VerificationStatus.VERIFIED
        company.verified_at = timezone.now()
        company.rejected_reason = ''
    else:
        company.verification_status = Company.VerificationStatus.REJECTED
        company.rejected_reason = reason
    company.save(
        update_fields=[
            'verification_status',
            'verified_at',
            'rejected_reason',
            'updated_at',
        ]
    )
    return company

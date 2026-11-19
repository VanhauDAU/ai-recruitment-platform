"""Company logo, cover and gallery images.

Before the first verification case or update request a company publishes media
directly. Afterwards an image either joins the page content change that
announced it (published at once, reviewed later) or is staged in the
requester's update request until an administrator approves it.
"""

from django.conf import settings
from django.core.files.base import File
from django.db import transaction
from django.db.models import Max
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework.exceptions import ValidationError

from apps.employers.domain.page_content import GALLERY_LIMIT
from apps.uploads.services import UploadServiceError, claim_clean_upload
from common.db.public_id import generate_public_id
from common.storage.media import delete_local_media_url, save_image_upload
from common.storage.r2 import private_media_storage

from ..models import CompanyImage, CompanyMediaUpload
from ..models.company_update import REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES
from .company_content_changes import publish_content_change_image
from .company_update_locks import lock_company_update_request
from .company_update_revisions import snapshot_company_update_request
from .upload_validation import (
    EmployerUploadSessionRejected,
    EmployerUploadStructureError,
    validate_employer_upload_structure,
)

EMPLOYER_MEDIA_PURPOSE = 'employer_company_update'
EMPLOYER_MEDIA_CLAIM_SCOPE = 'employer_company_media'
IMAGE_MAX_DIMENSIONS = (2400, 1600)
UPDATE_REQUEST_JUST_PROCESSED = {
    'update_request': gettext_lazy('Yêu cầu cập nhật này vừa được xử lý.')
}


def _gallery_limit_message():
    return _('Thư viện công ty chỉ được có tối đa %(limit)s ảnh.') % {'limit': GALLERY_LIMIT}


def _image_field(kind):
    return 'logo_url' if kind == 'logo' else 'cover_image_url'


def _save_scanned_image_derivative(*, user, company, update_request, kind, public_id):
    try:
        asset = claim_clean_upload(
            owner=user,
            public_id=public_id,
            expected_purpose=EMPLOYER_MEDIA_PURPOSE,
            claim_scope=EMPLOYER_MEDIA_CLAIM_SCOPE,
            claim_reference=generate_public_id('cma'),
        )
    except UploadServiceError as error:
        raise EmployerUploadSessionRejected(error) from error

    if asset.size_bytes > settings.IMAGE_UPLOAD_MAX_SIZE:
        raise ValidationError({'upload_session': _('Ảnh phải nhỏ hơn 5 MB.')})
    if asset.content_type not in {'image/jpeg', 'image/png', 'image/webp'}:
        raise ValidationError({'upload_session': _('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.')})
    try:
        validate_employer_upload_structure(asset)
    except EmployerUploadStructureError as error:
        raise ValidationError(
            {'upload_session': _('Nội dung ảnh bị lỗi hoặc không đúng định dạng khai báo.')}
        ) from error

    with private_media_storage().open(asset.storage_key, 'rb') as stored_file:
        upload = File(stored_file, name=asset.original_filename)
        upload.content_type = asset.content_type
        saved = save_image_upload(
            upload,
            f'employers/{company.public_id}/{kind}s',
            max_dimensions=IMAGE_MAX_DIMENSIONS,
        )

    CompanyMediaUpload.objects.create(
        public_id=asset.claim_reference,
        company=company,
        uploaded_by=user,
        update_request=update_request,
        upload_asset=asset,
        kind=kind,
        public_path=saved['path'],
    )
    return saved


def _stage_image(update_request, company, kind, path):
    """Record ``path`` in the locked request; returns the staged path it replaces."""
    changes = dict(update_request.changes)
    replaced_path = ''
    if kind == 'gallery':
        additions = list(changes.get('gallery_additions', []))
        deletions = set(changes.get('gallery_deletions', []))
        final_count = company.images.exclude(id__in=deletions).count() + len(additions) + 1
        if final_count > GALLERY_LIMIT:
            raise ValidationError({'file': _gallery_limit_message()})
        additions.append(path)
        changes['gallery_additions'] = additions
        changes.pop('gallery_pending', None)
    elif kind == 'logo':
        replaced_path = changes.get('logo_url', '')
        changes['logo_url'] = path
        changes['has_no_logo'] = False
        changes.pop('logo_pending', None)
    else:
        replaced_path = changes.get('cover_image_url', '')
        changes['cover_image_url'] = path
        changes.pop('cover_pending', None)
    update_request.changes = changes
    update_request.save(update_fields=['changes', 'updated_at'])
    return replaced_path


def _publish_image(company, kind, path):
    if kind == 'gallery':
        last_order = company.images.aggregate(value=Max('sort_order'))['value']
        CompanyImage.objects.create(
            company=company,
            image_url=path,
            sort_order=(last_order + 1) if last_order is not None else 0,
        )
        return
    field = _image_field(kind)
    delete_local_media_url(getattr(company, field))
    # Lưu key của storage thay vì URL tuyệt đối phụ thuộc localhost/domain.
    setattr(company, field, path)
    update_fields = [field, 'updated_at']
    if kind == 'logo':
        company.has_no_logo = False
        update_fields.append('has_no_logo')
    company.save(update_fields=update_fields)


def save_company_image(
    *,
    user,
    company,
    kind,
    update_request=None,
    content_change=None,
    upload=None,
    upload_session_public_id='',
):
    """Store a ``logo``/``cover``/``gallery`` image from a raw file or a scanned session.

    With ``update_request`` the image is staged there (the request is locked and
    re-checked); with ``content_change`` it is published into that change;
    otherwise it is published at once. Returns ``(company, update_request)`` as
    reloaded under the lock. The stored file is removed if anything fails, and
    a staged image it replaces is removed after commit.
    """
    if kind == 'gallery' and update_request is None and company.images.count() >= GALLERY_LIMIT:
        raise ValidationError({'file': _gallery_limit_message()})

    saved = None
    try:
        with transaction.atomic():
            if upload_session_public_id:
                saved = _save_scanned_image_derivative(
                    user=user,
                    company=company,
                    update_request=update_request,
                    kind=kind,
                    public_id=upload_session_public_id,
                )
            else:
                saved = save_image_upload(
                    upload,
                    f'employers/{company.public_id}/{kind}s',
                    max_dimensions=IMAGE_MAX_DIMENSIONS,
                )

            if content_change is not None:
                company = publish_content_change_image(
                    content_change, company=company, kind=kind, path=saved['path']
                )
            elif update_request is None:
                _publish_image(company, kind, saved['path'])
            else:
                company, update_request = lock_company_update_request(
                    company_id=company.pk,
                    update_request_id=update_request.pk,
                )
                if update_request.status not in REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES:
                    raise ValidationError(UPDATE_REQUEST_JUST_PROCESSED)
                replaced_path = _stage_image(update_request, company, kind, saved['path'])
                snapshot_company_update_request(update_request, actor=user)
                if replaced_path:
                    transaction.on_commit(lambda: delete_local_media_url(replaced_path))
    except Exception:
        if saved:
            delete_local_media_url(saved['path'])
        raise
    return company, update_request


def remove_company_image(*, user, company, kind, update_request=None):
    """Clear the logo or cover, staged in ``update_request`` or published at once.

    Returns ``(company, update_request)`` like ``save_company_image``.
    """
    field = _image_field(kind)
    if update_request is None:
        delete_local_media_url(getattr(company, field))
        setattr(company, field, '')
        update_fields = [field, 'updated_at']
        if kind == 'logo':
            company.has_no_logo = True
            update_fields.append('has_no_logo')
        company.save(update_fields=update_fields)
        return company, None

    with transaction.atomic():
        company, update_request = lock_company_update_request(
            company_id=company.pk,
            update_request_id=update_request.pk,
        )
        if update_request.status not in REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES:
            raise ValidationError(UPDATE_REQUEST_JUST_PROCESSED)
        changes = dict(update_request.changes)
        staged_path = changes.pop(field, '')
        changes.pop(f'{kind}_pending', None)
        if kind == 'logo':
            changes['has_no_logo'] = True
        else:
            changes['cover_image_url'] = ''
        update_request.changes = changes
        update_request.save(update_fields=['changes', 'updated_at'])
        snapshot_company_update_request(update_request, actor=user)
        if staged_path:
            transaction.on_commit(lambda: delete_local_media_url(staged_path))
    return company, update_request


def delete_company_gallery_image(image):
    """Remove a published gallery image and its file (direct-edit phase only)."""
    delete_local_media_url(image.image_url)
    image.delete()

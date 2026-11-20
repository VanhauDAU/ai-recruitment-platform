"""Ghi banner từ trang quản trị (tạo, sửa, xóa, sắp thứ tự)."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils.translation import gettext as _

from apps.accounts.models import AdminAccessAuditLog
from common.storage.media import delete_local_media_url, media_storage_path

from ..models import Banner
from .announcement_content import validate_cta_url
from .banner_media import BANNER_DIRECTORY

BANNER_WRITE_FIELDS = (
    'placement',
    'kind',
    'company',
    'eyebrow',
    'title',
    'subtitle',
    'image_url',
    'theme',
    'cta_label',
    'cta_url',
    'cta_secondary_label',
    'cta_secondary_url',
    'is_active',
    'starts_at',
    'ends_at',
)
URL_FIELDS = ('cta_url', 'cta_secondary_url')


def _image_path(value):
    """Ảnh banner chỉ nhận file đã tải lên qua API quản trị (không URL ngoài)."""
    if not value:
        return ''
    path = media_storage_path(value)
    if not path or not path.startswith(f'{BANNER_DIRECTORY}/'):
        raise ValidationError({'image_url': _('Ảnh phải được tải lên từ trang quản trị.')})
    return path


def _apply(banner, data):
    if 'image_url' in data and data['image_url'] != banner.image_url:
        data = {**data, 'image_url': _image_path(data['image_url'])}
    for field in BANNER_WRITE_FIELDS:
        if field in data:
            setattr(banner, field, data[field])
    for field in URL_FIELDS:
        try:
            setattr(banner, field, validate_cta_url((getattr(banner, field) or '').strip()))
        except ValidationError as error:
            raise ValidationError({field: error.messages}) from error
    banner.full_clean(exclude=['order'])


def _record(actor, action, target_public_id, payload):
    AdminAccessAuditLog.objects.record(
        actor=actor,
        action=action,
        target_type='banner',
        target_public_id=target_public_id,
        payload=payload,
    )


def _audit(actor, action, banner, payload=None):
    _record(
        actor,
        action,
        str(banner.pk),
        {'placement': banner.placement, 'kind': banner.kind, **(payload or {})},
    )


def _delete_media_after_commit(path):
    if path:
        transaction.on_commit(lambda: delete_local_media_url(path))


@transaction.atomic
def create_banner(*, actor, data):
    banner = Banner()
    _apply(banner, data)
    last = Banner.objects.filter(placement=banner.placement).aggregate(last=Max('order'))['last']
    banner.order = 0 if last is None else last + 1
    banner.save()
    _audit(actor, 'banner.create', banner)
    return banner


@transaction.atomic
def update_banner(*, actor, banner, data):
    old_image = banner.image_url
    _apply(banner, data)
    banner.save()
    if old_image and old_image != banner.image_url:
        _delete_media_after_commit(old_image)
    _audit(actor, 'banner.update', banner, {'fields': sorted(data)})
    return banner


@transaction.atomic
def delete_banner(*, actor, banner):
    _audit(actor, 'banner.delete', banner, {'title': banner.title})
    _delete_media_after_commit(banner.image_url)
    banner.delete()


@transaction.atomic
def reorder_banners(*, actor, placement, ids):
    """Đặt lại thứ tự theo danh sách id; danh sách phải đủ mọi banner của vị trí."""
    banners = {banner.pk: banner for banner in Banner.objects.filter(placement=placement)}
    if len(ids) != len(set(ids)) or set(ids) != set(banners):
        raise ValidationError(
            {'ids': _('Danh sách phải gồm đủ mọi banner của vị trí, không trùng.')}
        )
    for position, banner_id in enumerate(ids):
        banners[banner_id].order = position
    Banner.objects.bulk_update(banners.values(), ['order'])
    _record(actor, 'banner.reorder', placement, {'ids': ids})

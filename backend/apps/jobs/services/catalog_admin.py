"""Quản trị danh mục của tin tuyển dụng: cây ngành nghề ba cấp, phúc lợi, ngôn ngữ."""

from django.db import transaction
from django.utils.translation import gettext
from PIL import Image
from rest_framework.exceptions import ValidationError

from apps.accounts.services import record_admin_action
from common.storage.media import delete_local_media_url, save_image_upload, validate_image_upload

from ..models import Benefit, JobCategory, JobCategoryLocalization

Type = JobCategory.CategoryType
# Cấp của mục được suy ra từ mục cha: không có cha là nhóm nghề, dưới nhóm nghề là
# kiến thức chuyên ngành, dưới kiến thức chuyên ngành là vị trí chuyên môn. Vì mục cha
# luôn cao hơn đúng một cấp nên cây không thể có vòng lặp.
CHILD_TYPE = {
    None: Type.OCCUPATION_GROUP,
    Type.OCCUPATION_GROUP: Type.DOMAIN,
    Type.DOMAIN: Type.SPECIALIZATION,
}

ICON_DIRECTORY = 'jobs/categories/logos'
ICON_MAX_BYTES = 512 * 1024
ICON_MIN_SIDE = 64
ICON_MAX_SIDE = 512


def _child_type(parent):
    key = parent.category_type if parent else None
    if key not in CHILD_TYPE:
        raise ValidationError(
            {'parent': gettext('Vị trí chuyên môn là cấp cuối, không chứa mục con.')}
        )
    return CHILD_TYPE[key]


def _clean(value):
    return ' '.join(str(value).split())


def _sync_localizations(category, name_en):
    """Tên tiếng Việt của bản dịch luôn theo `name`; `name_en` rỗng thì bỏ bản tiếng Anh."""
    Locale = JobCategoryLocalization.Locale
    category.localizations.filter(locale=Locale.VI).update(display_name=category.name)
    if name_en is None:
        return
    if not name_en:
        category.localizations.filter(locale=Locale.EN).delete()
        return
    JobCategoryLocalization.objects.update_or_create(
        category=category, locale=Locale.EN, defaults={'display_name': name_en}
    )
    JobCategoryLocalization.objects.get_or_create(
        category=category, locale=Locale.VI, defaults={'display_name': category.name}
    )


@transaction.atomic
def save_job_category(*, actor, category=None, name_en=None, **changes):
    """Tạo (khi `category` là None) hoặc sửa một mục ngành nghề."""
    creating = category is None
    category = category or JobCategory()
    name_en = None if name_en is None else _clean(name_en)
    if creating or 'parent' in changes:
        kind = _child_type(changes.get('parent'))
        if not creating and kind != category.category_type:
            raise ValidationError(
                {'parent': gettext('Chỉ chuyển được sang một mục cùng cấp với mục cha hiện tại.')}
            )
        changes['category_type'] = kind
    # Bộ chọn vị trí của CV hiển thị theo ngôn ngữ, nên vị trí chuyên môn luôn cần tên tiếng Anh.
    kind = changes.get('category_type', category.category_type)
    if kind == Type.SPECIALIZATION and (name_en == '' or (creating and not name_en)):
        raise ValidationError({'name_en': gettext('Vị trí chuyên môn cần có tên tiếng Anh.')})
    if 'name' in changes:
        changes['name'] = _clean(changes['name'])
        parent = changes.get('parent', category.parent)
        siblings = JobCategory.objects.filter(parent=parent, name__iexact=changes['name'])
        if siblings.exclude(pk=category.pk).exists():
            raise ValidationError({'name': gettext('Đã có mục cùng tên ở cùng cấp.')})
    old_logo = category.logo_url
    for field, value in changes.items():
        setattr(category, field, value)
    category.save()
    if old_logo and old_logo != category.logo_url:
        transaction.on_commit(lambda: delete_local_media_url(old_logo))
    _sync_localizations(category, name_en)
    fields = sorted({*changes, *(['name_en'] if name_en is not None else [])})
    record_admin_action(
        actor=actor,
        action='job_category.create' if creating else 'job_category.update',
        target_type='JobCategory',
        target_public_id=category.public_id,
        payload={'fields': fields},
    )
    return category


def upload_category_icon(*, upload, request=None):
    """Icon nhóm nghề: ảnh gần vuông, tối thiểu 64 px, tối đa 512 KB; trả storage key và URL."""
    if upload is None:
        raise ValidationError({'file': gettext('Chọn file ảnh.')})
    if upload.size > ICON_MAX_BYTES:
        raise ValidationError({'file': gettext('Ảnh tối đa 512 KB.')})
    validate_image_upload(upload)
    try:
        with Image.open(upload) as image:
            width, height = image.size
            is_gif = image.format == 'GIF'
    except OSError as error:
        raise ValidationError({'file': gettext('Không đọc được file ảnh.')}) from error
    finally:
        upload.seek(0)
    if is_gif:
        raise ValidationError({'file': gettext('Chỉ nhận ảnh JPEG, PNG hoặc WebP.')})
    if min(width, height) < ICON_MIN_SIDE or not 0.8 <= width / height <= 1.25:
        raise ValidationError({'file': gettext('Icon cần gần vuông và tối thiểu 64×64 px.')})
    saved = save_image_upload(
        upload, ICON_DIRECTORY, request=request, max_dimensions=(ICON_MAX_SIDE, ICON_MAX_SIDE)
    )
    return {'path': saved['path'], 'url': saved['url']}


def save_catalog_entry(*, actor, entry, **changes):
    """Tạo hoặc sửa một mục phúc lợi/ngôn ngữ đã được serializer kiểm tra trùng tên."""
    creating = entry.pk is None
    if creating and isinstance(entry, Benefit) and 'sort_order' not in changes:
        last = Benefit.objects.order_by('-sort_order').values_list('sort_order', flat=True).first()
        changes['sort_order'] = (last or 0) + 1
    for field, value in changes.items():
        setattr(entry, field, value)
    entry.save()
    name = entry.__class__.__name__
    record_admin_action(
        actor=actor,
        action=f'{name.lower()}.{"create" if creating else "update"}',
        target_type=name,
        target_public_id=str(entry.pk),
        payload={'fields': sorted(changes)},
    )
    return entry


@transaction.atomic
def reorder_benefits(*, actor, ids):
    """Đặt thứ tự hiển thị theo đúng danh sách id; danh sách phải gồm mọi phúc lợi."""
    benefits = {benefit.pk: benefit for benefit in Benefit.objects.select_for_update()}
    if sorted(ids) != sorted(benefits):
        raise ValidationError(
            {'ids': gettext('Danh sách phải gồm đủ mọi phúc lợi, mỗi mục một lần.')}
        )
    for order, pk in enumerate(ids):
        benefits[pk].sort_order = order
    Benefit.objects.bulk_update(benefits.values(), ['sort_order'])
    record_admin_action(
        actor=actor,
        action='benefit.reorder',
        target_type='Benefit',
        target_public_id='',
        payload={'ids': ids},
    )

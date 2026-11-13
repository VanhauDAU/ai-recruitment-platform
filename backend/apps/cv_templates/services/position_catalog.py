"""Quản trị vị trí CV: độ phủ nội dung mẫu và chuyển cấu hình giữa môi trường (CVT-3).

Import/export dùng `JobCategory.slug` làm khóa vì `public_id` khác nhau giữa các
môi trường. Nội dung mẫu nhập vào luôn là bản nháp `origin=import`, không bao
giờ tự xuất bản.
"""

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.jobs.models import JobCategory

from ..models import (
    CATALOG_LANGUAGES,
    EXPERIENCE_BAND_ORDER,
    CvPositionField,
    CvPositionProfile,
    CvSampleContent,
)

EXPORT_FORMAT = 'cv-positions-v1'
FIELD_ATTRIBUTES = (
    'key',
    'label_vi',
    'label_en',
    'placeholder_vi',
    'placeholder_en',
    'field_type',
    'options',
    'maps_to',
    'is_required_hint',
    'is_active',
    'sort_order',
)


def coverage_matrix(profiles):
    """Trạng thái nội dung riêng của từng vị trí theo ngôn ngữ × nhóm kinh nghiệm.

    `published` = có nội dung riêng đang xuất bản, `pending` = chỉ có nháp/chờ
    duyệt, `generic` = dùng nội dung chung. Một truy vấn cho mọi vị trí.
    """
    rows = CvSampleContent.objects.filter(
        position_profile__in=profiles,
        status__in=[
            CvSampleContent.Status.PUBLISHED,
            CvSampleContent.Status.DRAFT,
            CvSampleContent.Status.IN_REVIEW,
        ],
    ).values_list('position_profile_id', 'locale', 'experience_band', 'status')
    states = {}
    for profile_id, locale, band, status in rows:
        key = (profile_id, locale, band)
        if status == CvSampleContent.Status.PUBLISHED or key not in states:
            states[key] = 'published' if status == CvSampleContent.Status.PUBLISHED else 'pending'
    return {
        profile.pk: {
            language.code: {
                band: states.get((profile.pk, language.code, band), 'generic')
                for band in EXPERIENCE_BAND_ORDER
            }
            for language in CATALOG_LANGUAGES
        }
        for profile in profiles
    }


def export_positions(profiles):
    profiles = profiles.select_related('job_category').prefetch_related('fields')
    published = CvSampleContent.objects.filter(
        position_profile__in=profiles, status=CvSampleContent.Status.PUBLISHED
    ).order_by('locale', 'experience_band')
    samples = {}
    for sample in published:
        samples.setdefault(sample.position_profile_id, []).append(
            {
                'locale': sample.locale,
                'experience_band': sample.experience_band,
                'title': sample.title,
                'content_json': sample.content_json,
            }
        )
    return {
        'format': EXPORT_FORMAT,
        'positions': [
            {
                'job_category_slug': profile.job_category.slug,
                'section_preset': profile.section_preset,
                'keywords': profile.keywords,
                'is_active': profile.is_active,
                'sort_order': profile.sort_order,
                'fields': [
                    {name: getattr(field, name) for name in FIELD_ATTRIBUTES}
                    for field in profile.fields.all()
                ],
                'samples': samples.get(profile.pk, []),
            }
            for profile in profiles
        ],
    }


def _import_position(entry, actor):
    category = JobCategory.objects.filter(
        slug=entry.get('job_category_slug'),
        category_type=JobCategory.CategoryType.SPECIALIZATION,
    ).first()
    if category is None:
        raise ValidationError(
            {'job_category_slug': f'Không có vị trí {entry.get("job_category_slug")!r}.'}
        )
    profile = CvPositionProfile.objects.filter(job_category=category).first() or CvPositionProfile(
        job_category=category
    )
    for name in ('section_preset', 'keywords', 'is_active', 'sort_order'):
        if name in entry:
            setattr(profile, name, entry[name])
    profile.full_clean()
    profile.save()
    for data in entry.get('fields', []):
        field = CvPositionField.objects.filter(profile=profile, key=data.get('key')).first()
        field = field or CvPositionField(profile=profile)
        for name in FIELD_ATTRIBUTES:
            if name in data:
                setattr(field, name, data[name])
        field.full_clean()
        field.save()
    imported = 0
    for data in entry.get('samples', []):
        sample = CvSampleContent(
            position_profile=profile,
            locale=data.get('locale'),
            experience_band=data.get('experience_band'),
            title=data.get('title', ''),
            content_json=data.get('content_json', {}),
            status=CvSampleContent.Status.DRAFT,
            origin=CvSampleContent.Origin.IMPORT,
            created_by=actor,
        )
        sample.full_clean()
        sample.save()
        imported += 1
    return imported


@transaction.atomic
def import_positions(payload, *, actor):
    """Upsert vị trí + trường riêng theo slug; nội dung mẫu vào nháp. Lỗi thì không ghi gì."""
    if not isinstance(payload, dict) or payload.get('format') != EXPORT_FORMAT:
        raise ValidationError({'format': f'Cần định dạng {EXPORT_FORMAT}.'})
    positions = payload.get('positions')
    if not isinstance(positions, list):
        raise ValidationError({'positions': 'Phải là danh sách.'})
    samples = 0
    for index, entry in enumerate(positions):
        try:
            samples += _import_position(entry if isinstance(entry, dict) else {}, actor)
        except ValidationError as error:
            details = error.message_dict if hasattr(error, 'message_dict') else {'': error.messages}
            raise ValidationError(
                {
                    f'positions[{index}].{name}'.rstrip('.'): messages
                    for name, messages in details.items()
                }
            ) from error
    return {'positions': len(positions), 'samples': samples}

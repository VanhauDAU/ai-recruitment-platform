"""Resolve deterministic, renderer-neutral CV starter content for a position.

Thứ tự ưu tiên (CVT-1b): nhóm kinh nghiệm gần nhất với nhóm được chọn trước
(để mục tiêu, chức danh, số năm không sai), cùng khoảng cách thì nội dung riêng
của vị trí trước nội dung chung, rồi đến nhóm cao hơn. Nội dung chung được thay
token `{position}` bằng tên vị trí theo ngôn ngữ; mọi nội dung đều được sắp xếp
section theo `CvPositionProfile.section_preset`.
"""

from copy import deepcopy

from django.db.models import Q

from apps.jobs.models import JobCategory, JobCategoryLocalization

from ..content_tokens import _materialize_tokens
from ..models import EXPERIENCE_BAND_ORDER, CvPositionProfile, CvSampleContent


class PositionContentUnavailable(ValueError):
    """Required localized/configured content is not published for this selection."""


def _localized_name(position, locale):
    localization = JobCategoryLocalization.objects.filter(
        category=position,
        locale=locale,
        is_active=True,
    ).first()
    if localization:
        return localization.display_name
    raise PositionContentUnavailable(f'Vị trí chưa được cấu hình nội dung cho ngôn ngữ {locale}.')


def _name_vi(position):
    localization = JobCategoryLocalization.objects.filter(
        category=position,
        locale=JobCategoryLocalization.Locale.VI,
        is_active=True,
    ).first()
    return localization.display_name if localization else position.name


def _active_profile(position):
    if (
        position.status != JobCategory.Status.ACTIVE
        or position.category_type != JobCategory.CategoryType.SPECIALIZATION
    ):
        raise PositionContentUnavailable('Vị trí chuyên môn không hoạt động.')
    profile = CvPositionProfile.objects.filter(job_category=position, is_active=True).first()
    if profile is None:
        raise PositionContentUnavailable('Vị trí chưa được bật cho CV.')
    return profile


def _pick_sample(samples, profile, experience_band):
    """Chọn mẫu theo thứ tự ưu tiên ở docstring module."""
    wanted = EXPERIENCE_BAND_ORDER.index(experience_band)

    def rank(sample):
        is_generic = sample.position_profile_id != profile.pk
        distance = abs(EXPERIENCE_BAND_ORDER.index(sample.experience_band) - wanted)
        # Cùng khoảng cách thì ưu tiên nhóm cao hơn (nội dung đầy đủ hơn).
        return (distance, is_generic, -EXPERIENCE_BAND_ORDER.index(sample.experience_band))

    return min(samples, key=rank, default=None)


def _apply_section_preset(content, preset):
    """Sắp xếp và bật/tắt section theo preset; section ngoài preset bị tắt, giữ ở cuối."""
    if not preset:
        return content
    positions = {entry['section_key']: index for index, entry in enumerate(preset)}
    enabled = {entry['section_key']: entry.get('enabled', True) for entry in preset}
    sections = content.get('sections', [])
    for section in sections:
        key = section.get('section_key')
        section['enabled'] = enabled.get(key, False)
    sections.sort(key=lambda section: positions.get(section.get('section_key'), len(positions)))
    return content


def resolve_position_content(*, position, locale, experience_band, lock=False):
    """Return starter content for a position, language and experience band."""
    profile = _active_profile(position)
    samples = CvSampleContent.objects.filter(
        Q(position_profile=profile) | Q(position_profile__isnull=True),
        locale=locale,
        status=CvSampleContent.Status.PUBLISHED,
    )
    if lock:
        samples = samples.select_for_update()
    sample = _pick_sample(list(samples), profile, experience_band)
    if sample is None:
        raise PositionContentUnavailable(f'Chưa có nội dung CV mẫu cho ngôn ngữ {locale}.')

    content = deepcopy(sample.content_json)
    is_generic = sample.position_profile_id is None
    if is_generic:
        content = _materialize_tokens(content, _localized_name(position, locale))
    content = _apply_section_preset(content, profile.section_preset)
    return {
        'position_public_id': position.public_id,
        'name_vi': _name_vi(position),
        'locale': locale,
        'experience_band': sample.experience_band,
        'source': 'generic' if is_generic else 'curated',
        'sample_content_public_id': sample.public_id,
        'schema_version': sample.schema_version,
        'content_json': content,
    }

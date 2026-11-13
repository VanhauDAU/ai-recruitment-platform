"""Sinh nội dung CV mẫu bằng AI cho admin duyệt (CVT-3, kế hoạch CVT-v3 mục 9.3).

Admin chọn vị trí × ngôn ngữ × nhóm kinh nghiệm; mỗi tổ hợp là một
`CvSampleGeneration` chạy trên hàng đợi `ai-generation` qua runtime `ai_core`
(ghi `AiInvocation`, không lưu prompt hay phản hồi). Kết quả là một
`CvSampleContent` ở trạng thái `in_review` — không có gì được xuất bản nếu admin
chưa duyệt.

Nội dung mẫu không bao giờ chứa danh tính: schema phản hồi không có trường tên,
email, điện thoại, và bộ kiểm tra từ chối mọi email, số điện thoại hay liên kết
lọt vào văn bản (danh tính minh họa chỉ được thêm lúc hiển thị, xem
`demo_identity.py`).
"""

import re
from datetime import date, timedelta
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from apps.cvs.schemas import empty_content, empty_layout, empty_style, validate_cv_document
from apps.jobs.models import Job, JobCategoryLocalization

from ..models import (
    CvLanguage,
    CvPositionField,
    CvPositionProfile,
    CvSampleContent,
    CvSampleGeneration,
    ExperienceBand,
)
from .position_fields import position_details_section

USE_CASE = 'cv_sample_content'
PROMPT_VERSION = 'cv-sample-v1'
SCHEMA_VERSION = 'cv-sample-content-v1'
MAX_BATCH_SIZE = 16
STALE_AFTER = timedelta(minutes=10)

# Số năm và số mục kinh nghiệm theo nhóm (cùng mốc với `Job.ExperienceYears`).
BAND_BRIEFS = {
    ExperienceBand.ENTRY: ('dưới 1 năm', 'under 1 year', 1),
    ExperienceBand.JUNIOR: ('1–2 năm', '1–2 years', 1),
    ExperienceBand.MID: ('3–4 năm', '3–4 years', 2),
    ExperienceBand.SENIOR: ('từ 5 năm trở lên', '5+ years', 3),
}
LANGUAGE_NAMES = {CvLanguage.VI: 'tiếng Việt', CvLanguage.EN: 'English'}

YEAR_MONTH = r'^\d{4}-(0[1-9]|1[0-2])$'
_STRING = {'type': 'string', 'minLength': 1, 'maxLength': 300}
RESPONSE_SCHEMA = {
    'type': 'object',
    'properties': {
        'headline': {'type': 'string', 'minLength': 2, 'maxLength': 60},
        'summary': {'type': 'string', 'minLength': 20, 'maxLength': 700},
        'experience': {
            'type': 'array',
            'minItems': 1,
            'maxItems': 4,
            'items': {
                'type': 'object',
                'properties': {
                    'role': _STRING,
                    'company': _STRING,
                    'start_date': {'type': 'string', 'pattern': YEAR_MONTH},
                    'end_date': {'type': 'string', 'description': 'YYYY-MM, rỗng nếu đang làm'},
                    'highlights': {
                        'type': 'array',
                        'minItems': 2,
                        'maxItems': 5,
                        'items': {'type': 'string', 'minLength': 8, 'maxLength': 300},
                    },
                },
                'required': ['role', 'company', 'start_date', 'end_date', 'highlights'],
            },
        },
        'education': {
            'type': 'array',
            'minItems': 1,
            'maxItems': 2,
            'items': {
                'type': 'object',
                'properties': {
                    'degree': _STRING,
                    'institution': _STRING,
                    'degree_level': {'type': 'string', 'enum': list(Job.EducationLevel.values)},
                    'start_date': {'type': 'string', 'pattern': YEAR_MONTH},
                    'end_date': {'type': 'string', 'pattern': YEAR_MONTH},
                },
                'required': ['degree', 'institution', 'degree_level', 'start_date', 'end_date'],
            },
        },
        'skills': {
            'type': 'array',
            'minItems': 3,
            'maxItems': 8,
            'items': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string', 'minLength': 1, 'maxLength': 60},
                    'level': {'type': 'integer', 'minimum': 1, 'maximum': 5},
                },
                'required': ['name', 'level'],
            },
        },
        'position_details': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'field_key': {'type': 'string'},
                    'text': {'type': 'string', 'maxLength': 600},
                    'values': {'type': 'array', 'items': {'type': 'string', 'maxLength': 60}},
                },
                'required': ['field_key'],
            },
        },
    },
    'required': ['headline', 'summary', 'experience', 'education', 'skills', 'position_details'],
}

SYSTEM_INSTRUCTION = """Bạn soạn nội dung CV MẪU hư cấu để ứng viên tham khảo khi viết CV.
Viết đúng ngôn ngữ được yêu cầu, cụ thể theo vị trí và số năm kinh nghiệm, có số liệu
hợp lý. Công ty và trường học là tên chung chung hư cấu (ví dụ "Công ty Công nghệ ABC").
TUYỆT ĐỐI không đưa tên người, email, số điện thoại, địa chỉ, liên kết hay mạng xã hội
vào bất kỳ trường nào. Chỉ trả JSON đúng response schema."""

_EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
_PHONE_RE = re.compile(r'(?:\+?\d[\s.-]?){9,}')
_URL_RE = re.compile(r'https?://|www\.', re.IGNORECASE)


class SampleGenerationUnavailable(ValueError):
    """Yêu cầu sinh không hợp lệ hoặc runtime AI chưa sẵn sàng (mã lỗi an toàn)."""

    def __init__(self, code):
        self.code = code
        super().__init__(code)


def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def contains_personal_data(data):
    """True nếu văn bản sinh ra chứa email, số điện thoại hoặc liên kết."""
    return any(
        _EMAIL_RE.search(text) or _PHONE_RE.search(text) or _URL_RE.search(text)
        for text in _strings(data)
    )


def _validate_generated(data):
    from apps.ai_core.services import AiGenerationError

    if not isinstance(data, dict) or any(
        not isinstance(data.get(key), list)
        for key in ('experience', 'education', 'skills', 'position_details')
    ):
        raise AiGenerationError('invalid_ai_schema', retryable=True)
    if contains_personal_data(data):
        raise AiGenerationError('personal_data_detected', retryable=True)


def _position_name(profile, locale):
    localization = JobCategoryLocalization.objects.filter(
        category=profile.job_category, locale=locale, is_active=True
    ).first()
    return localization.display_name if localization else profile.job_category.name


def build_prompt(profile, locale, band):
    vi_years, en_years, roles = BAND_BRIEFS[band]
    fields = [
        f'- {field.key} ({field.get_field_type_display()}): {field.label(locale)}'
        + (f' — chọn trong: {", ".join(field.option_labels(locale))}' if field.options else '')
        for field in profile.fields.all()
        if field.is_active
    ]
    return '\n'.join(
        [
            f'Ngôn ngữ của toàn bộ nội dung, kể cả tên kỹ năng: {LANGUAGE_NAMES[locale]} '
            '(dịch từ khóa gợi ý nếu khác ngôn ngữ).',
            f'Vị trí: {_position_name(profile, locale)}.',
            'headline: chức danh mong muốn ngắn gọn (tối đa 60 ký tự), không phải câu mô tả.',
            f'Kinh nghiệm: {vi_years} ({en_years}); viết {roles} mục kinh nghiệm, mới nhất trước,',
            f'mục mới nhất đang làm (end_date rỗng); hôm nay là {date.today():%Y-%m}.',
            'Kỹ năng gợi ý: ' + (', '.join(profile.keywords) or 'tự chọn theo vị trí') + '.',
            'Trường chuyên môn cần điền (field_key; trường chọn lấy đúng nhãn lựa chọn; '
            'trường thẻ/chọn nhiều điền vào "values", còn lại điền "text"; '
            'trường liên kết để trống):',
            *(fields or ['- (không có)']),
        ]
    )


def _rich_text(lines):
    return {
        'format': 'rich_text_v1',
        'content': [{'type': 'bullet', 'text': line.strip()} for line in lines if line.strip()],
    }


def _detail_values(profile, locale, generated):
    """Giá trị trường riêng đúng kiểu; giá trị sai kiểu hoặc ngoài lựa chọn bị bỏ."""
    by_key = {item.get('field_key'): item for item in generated if isinstance(item, dict)}
    values = {}
    for field in profile.fields.all():
        item = by_key.get(field.key) or {}
        text = (item.get('text') or '').strip()
        listed = [value.strip() for value in item.get('values') or [] if value.strip()][:30]
        options = field.option_labels(locale)
        if field.field_type == CvPositionField.FieldType.TAGS:
            values[field.key] = listed
        elif field.field_type == CvPositionField.FieldType.MULTI_SELECT:
            values[field.key] = [value for value in listed if value in options]
        elif field.field_type == CvPositionField.FieldType.SELECT and text in options:
            values[field.key] = text
        elif field.field_type == CvPositionField.FieldType.TEXT:
            values[field.key] = text[:200]
        elif field.field_type == CvPositionField.FieldType.LONG_TEXT:
            values[field.key] = text[:2000]
        # Liên kết, số, ngày: để ứng viên tự điền, không để AI bịa.
    return values


SECTION_TITLES = {
    CvLanguage.VI: {
        'summary': 'Mục tiêu nghề nghiệp',
        'experience': 'Kinh nghiệm làm việc',
        'education': 'Học vấn',
        'skills': 'Kỹ năng',
    },
    CvLanguage.EN: {
        'summary': 'Career objective',
        'experience': 'Work experience',
        'education': 'Education',
        'skills': 'Skills',
    },
}


def generated_content(profile, locale, data):
    """Document chuẩn (không danh tính) từ phản hồi AI; raise `ValidationError` nếu sai."""
    content = empty_content(locale)
    content['personal_info']['headline'] = data['headline']
    items = {
        'summary': [{'item_id': 'summary_item_1', 'value': data['summary']}],
        'experience': [
            {
                'item_id': f'experience_item_{index}',
                'role': item['role'],
                'company': item['company'],
                'start_date': item['start_date'],
                'end_date': item.get('end_date') or None,
                'description': _rich_text(item['highlights']),
            }
            for index, item in enumerate(data['experience'], start=1)
        ],
        'education': [
            {
                'item_id': f'education_item_{index}',
                'degree': item['degree'],
                'institution': item['institution'],
                'degree_level': item['degree_level'],
                'start_date': item['start_date'],
                'end_date': item['end_date'],
            }
            for index, item in enumerate(data['education'], start=1)
        ],
        'skills': [
            {'item_id': f'skills_item_{index}', 'name': item['name'], 'level': item['level']}
            for index, item in enumerate(data['skills'], start=1)
        ],
    }
    content['sections'] = [
        {
            'instance_id': f'{key}_1',
            'section_key': key,
            'title': title,
            'enabled': True,
            'items': items[key],
        }
        for key, title in SECTION_TITLES[locale].items()
    ]
    details = position_details_section(
        profile, locale, values=_detail_values(profile, locale, data['position_details'])
    )
    if details:
        content['sections'].append({'instance_id': 'position_details_1', **details})
    layout = empty_layout()
    layout['regions'][0]['section_instance_ids'] = [s['instance_id'] for s in content['sections']]
    validate_cv_document(
        content_json=content, layout_json=layout, style_json=empty_style(), schema_version=1
    )
    return content


def _ensure_runtime_ready():
    from apps.ai_core.services import AiGenerationError, AiRuntimeConfig

    try:
        AiRuntimeConfig.from_django_settings().validate()
    except AiGenerationError as error:
        raise SampleGenerationUnavailable(error.code) from error


@transaction.atomic
def request_sample_generations(*, actor, profiles, locales, bands):
    """Tạo một lượt sinh cho mỗi tổ hợp và xếp hàng sau khi commit."""
    combinations = [
        (profile, locale, band) for profile in profiles for locale in locales for band in bands
    ]
    if not combinations:
        raise SampleGenerationUnavailable('empty_batch')
    if len(combinations) > MAX_BATCH_SIZE:
        raise SampleGenerationUnavailable('batch_too_large')
    _ensure_runtime_ready()
    # Lượt bị treo (worker chết giữa chừng) không được chặn các lượt mới mãi mãi.
    CvSampleGeneration.objects.filter(
        status__in=[CvSampleGeneration.Status.QUEUED, CvSampleGeneration.Status.PROCESSING],
        updated_at__lt=timezone.now() - STALE_AFTER,
    ).update(
        status=CvSampleGeneration.Status.FAILED, failure_code='stale', finished_at=timezone.now()
    )
    active = CvSampleGeneration.objects.filter(
        status__in=[CvSampleGeneration.Status.QUEUED, CvSampleGeneration.Status.PROCESSING]
    ).count()
    if active + len(combinations) > MAX_BATCH_SIZE:
        raise SampleGenerationUnavailable('generation_in_progress')
    batch_id = f'cvbatch_{uuid4().hex[:16]}'
    generations = [
        CvSampleGeneration.objects.create(
            batch_id=batch_id,
            position_profile=profile,
            locale=locale,
            experience_band=band,
            requested_by=actor,
        )
        for profile, locale, band in combinations
    ]

    def dispatch():
        from ..tasks import generate_cv_sample_content

        for generation in generations:
            generate_cv_sample_content.delay(generation.pk)

    transaction.on_commit(dispatch)
    return generations


@transaction.atomic
def _claim(generation_id):
    generation = (
        CvSampleGeneration.objects.select_for_update()
        .filter(pk=generation_id, status=CvSampleGeneration.Status.QUEUED)
        .first()
    )
    if generation is None:
        return None
    generation.status = CvSampleGeneration.Status.PROCESSING
    generation.save(update_fields=['status', 'updated_at'])
    return generation


def fail_sample_generation(generation_id, *, code, invocation_id=None):
    CvSampleGeneration.objects.filter(
        pk=generation_id,
        status__in=[CvSampleGeneration.Status.QUEUED, CvSampleGeneration.Status.PROCESSING],
    ).update(
        status=CvSampleGeneration.Status.FAILED,
        failure_code=code[:64],
        invocation_id=invocation_id,
        finished_at=timezone.now(),
        updated_at=timezone.now(),
    )


def execute_sample_generation(generation_id):
    """Chạy một lượt sinh; kết quả là nội dung mẫu chờ duyệt, lỗi chỉ lưu mã."""
    from django.core.exceptions import ValidationError

    from apps.ai_core.services import AiGenerationError, generate_structured

    generation = _claim(generation_id)
    if generation is None:
        return None
    profile = (
        CvPositionProfile.objects.select_related('job_category')
        .prefetch_related('fields')
        .get(pk=generation.position_profile_id)
    )
    locale, band = generation.locale, generation.experience_band
    try:
        result = generate_structured(
            use_case=USE_CASE,
            prompt=build_prompt(profile, locale, band),
            response_schema=RESPONSE_SCHEMA,
            prompt_version=PROMPT_VERSION,
            schema_version=SCHEMA_VERSION,
            system_instruction=SYSTEM_INSTRUCTION,
            result_validator=_validate_generated,
            correlation_key=generation.public_id,
        )
    except AiGenerationError as error:
        fail_sample_generation(generation.pk, code=error.code, invocation_id=error.invocation_id)
        return None
    try:
        content = generated_content(profile, locale, result.data)
    except (ValidationError, KeyError, TypeError):
        fail_sample_generation(
            generation.pk, code='invalid_document', invocation_id=result.invocation_id
        )
        return None
    with transaction.atomic():
        sample = CvSampleContent.objects.create(
            position_profile=profile,
            locale=locale,
            experience_band=band,
            title=f'{_position_name(profile, locale)} · {ExperienceBand(band).label}',
            content_json=content,
            status=CvSampleContent.Status.IN_REVIEW,
            origin=CvSampleContent.Origin.AI,
            created_by=generation.requested_by,
        )
        CvSampleGeneration.objects.filter(pk=generation.pk).update(
            status=CvSampleGeneration.Status.COMPLETED,
            sample=sample,
            invocation_id=result.invocation_id,
            finished_at=timezone.now(),
            updated_at=timezone.now(),
        )
    return sample

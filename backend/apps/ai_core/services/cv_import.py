"""Provider-neutral CV text structuring; never logs prompts or candidate PII."""

import re

from django.conf import settings

from apps.cv_templates.models import empty_content
from apps.sitecontent.selectors import get_bool_setting

from .contracts import AiGenerationError
from .runtime import generate_structured


class AiCvParseError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


USE_CASE = 'cv_import_structuring'
PROMPT_VERSION = 'cv-import-v2'
SCHEMA_VERSION = 'cv-import-v1'
# Không thể dùng AI vì cấu hình (tắt, thiếu credential/model): đọc CV bằng quy tắc.
UNAVAILABLE_CODES = {
    'runtime_disabled',
    'provider_not_configured',
    'model_not_configured',
    'unsupported_provider_backend',
}
_DATED_ITEM = {
    'type': 'object',
    'properties': {
        'start_date': {'type': 'string'},
        'end_date': {'type': 'string'},
        'description': {'type': 'string'},
    },
}
RESPONSE_SCHEMA = {
    'type': 'object',
    'properties': {
        'personal_info': {
            'type': 'object',
            'properties': {
                key: {'type': 'string'}
                for key in ('full_name', 'headline', 'email', 'phone', 'address')
            }
            | {'links': {'type': 'array', 'items': {'type': 'string'}}},
        },
        'summary': {'type': 'string'},
        'experiences': {
            'type': 'array',
            'items': {
                **_DATED_ITEM,
                'properties': {
                    'role': {'type': 'string'},
                    'company': {'type': 'string'},
                    **_DATED_ITEM['properties'],
                },
            },
        },
        'education': {
            'type': 'array',
            'items': {
                **_DATED_ITEM,
                'properties': {
                    'degree': {'type': 'string'},
                    'institution': {'type': 'string'},
                    **_DATED_ITEM['properties'],
                },
            },
        },
        'skills': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['personal_info', 'summary', 'experiences', 'education', 'skills'],
}


def _prompt(text, locale):
    return (
        'Extract this CV into the JSON schema. Do not invent facts; leave unknown fields '
        'empty. Dates use YYYY-MM or empty.\n'
        f'Output locale: {locale}. CV text follows:\n{text}'
    )


def _cv_import_model():
    return settings.AI_CV_IMPORT_MODEL or settings.AI_JOB_GENERATION_MODEL


def _call_provider(text, locale):
    """CV có cấu trúc từ runtime AI dùng chung; ``None`` khi AI không khả dụng do cấu hình."""
    try:
        result = generate_structured(
            use_case=USE_CASE,
            prompt=_prompt(text, locale),
            response_schema=RESPONSE_SCHEMA,
            prompt_version=PROMPT_VERSION,
            schema_version=SCHEMA_VERSION,
            result_validator=_validate_payload,
            model=_cv_import_model(),
        )
    except AiGenerationError as error:
        if error.code in UNAVAILABLE_CODES:
            return None
        raise AiCvParseError('ai_provider_failed') from error
    return result.data


def _heuristic(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    email = re.search(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', text)
    phone = re.search(r'(?<!\d)(?:\+?\d[\d .()-]{7,}\d)', text)
    return {
        'personal_info': {
            'full_name': lines[0][:120] if lines else '',
            'headline': '',
            'email': email.group(0) if email else '',
            'phone': phone.group(0) if phone else '',
            'address': '',
            'links': [],
        },
        'summary': '\n'.join(lines[1:8])[:1200],
        'experiences': [],
        'education': [],
        'skills': [],
        'projects': [],
    }


def _validate_payload(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get('personal_info'), dict):
        raise AiCvParseError('invalid_ai_schema')
    for field in ('experiences', 'education', 'skills', 'projects'):
        if not isinstance(payload.get(field, []), list):
            raise AiCvParseError('invalid_ai_schema')
    return payload


def _date(value):
    return (
        value if isinstance(value, str) and re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', value) else None
    )


def _rich_text(value):
    return {
        'format': 'rich_text_v1',
        'content': [
            {'type': 'paragraph', 'text': line.strip()}
            for line in str(value or '').splitlines()
            if line.strip()
        ],
    }


def _canonical(payload, locale):
    content = empty_content(locale)
    personal = payload.get('personal_info', {})
    for key in ('full_name', 'headline', 'email', 'phone', 'address'):
        content['personal_info'][key] = str(personal.get(key) or '')[:500]
    content['personal_info']['links'] = [
        str(item)[:500] for item in personal.get('links', []) if isinstance(item, str)
    ][:10]
    labels = {
        'vi-VN': ('Giới thiệu', 'Kinh nghiệm làm việc', 'Học vấn', 'Kỹ năng', 'Dự án'),
        'en-US': ('Summary', 'Work experience', 'Education', 'Skills', 'Projects'),
    }.get(locale, ('Summary', 'Work experience', 'Education', 'Skills', 'Projects'))
    summary = str(payload.get('summary') or '').strip()
    if summary:
        content['sections'].append(
            {
                'instance_id': 'summary_1',
                'section_key': 'summary',
                'title': labels[0],
                'enabled': True,
                'items': [{'item_id': 'summary_item_1', 'value': summary[:4000]}],
            }
        )
    mappings = [
        ('experiences', 'experience', labels[1], ('role', 'company')),
        ('education', 'education', labels[2], ('degree', 'institution')),
        ('projects', 'projects', labels[4], ('name', 'organization')),
    ]
    for source, section_key, title, fields in mappings:
        items = []
        for index, source_item in enumerate(payload.get(source, [])[:20]):
            if not isinstance(source_item, dict):
                continue
            item = {'item_id': f'{section_key}_item_{index + 1}'}
            item.update({field: str(source_item.get(field) or '')[:500] for field in fields})
            item['start_date'] = _date(source_item.get('start_date'))
            item['end_date'] = _date(source_item.get('end_date'))
            item['description'] = _rich_text(source_item.get('description'))
            items.append(item)
        if items:
            content['sections'].append(
                {
                    'instance_id': f'{section_key}_1',
                    'section_key': section_key,
                    'title': title,
                    'enabled': True,
                    'items': items,
                }
            )
    skills = [str(skill)[:200] for skill in payload.get('skills', []) if str(skill).strip()][:50]
    if skills:
        content['sections'].append(
            {
                'instance_id': 'skills_1',
                'section_key': 'skills',
                'title': labels[3],
                'enabled': True,
                'items': [
                    {'item_id': f'skills_item_{index + 1}', 'name': skill, 'level': ''}
                    for index, skill in enumerate(skills)
                ],
            }
        )
    return content


def structure_cv_text(text, locale):
    """CV text → nội dung CV chuẩn hoá.

    ``ai_enabled`` tắt hoặc AI không khả dụng do cấu hình thì đọc bằng quy tắc;
    lỗi của nhà cung cấp (sau khi runtime đã thử lại) báo ``ai_provider_failed``.
    """
    payload = _call_provider(text, locale) if get_bool_setting('ai_enabled', True) else None
    if payload is None:
        payload = _heuristic(text)
    return _canonical(_validate_payload(payload), locale)

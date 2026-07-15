"""Provider-neutral CV text structuring; never logs prompts or candidate PII."""

import json
import re

import requests
from decouple import config

from apps.cvs.schemas import empty_content
from apps.sitecontent.models import SiteSetting
from apps.sitecontent.selectors import get_string_setting


class AiCvParseError(ValueError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def _provider_api_key(name):
    """Read provider secrets through django's python-decouple configuration.

    `python-decouple` resolves values from the backend `.env` file without
    mutating `os.environ`, so adapters must not read `os.environ` directly.
    Real process environment variables still take precedence.
    """
    return config(name, default='')


def _setting_value(key, default=None):
    value = SiteSetting.objects.filter(key=key).values_list('value', flat=True).first()
    return default if value is None else value


def _json_from_text(value):
    value = value.strip()
    if value.startswith('```'):
        value = re.sub(r'^```(?:json)?\s*|\s*```$', '', value, flags=re.IGNORECASE)
    return json.loads(value)


def _prompt(text, locale):
    return f"""Extract this CV into JSON only. Do not invent facts.
Schema: {{"personal_info":{{"full_name":"","headline":"","email":"","phone":"","address":"","links":[]}},"summary":"","experiences":[{{"role":"","company":"","start_date":"YYYY-MM or empty","end_date":"YYYY-MM or empty","description":""}}],"education":[{{"degree":"","institution":"","start_date":"YYYY-MM or empty","end_date":"YYYY-MM or empty","description":""}}],"skills":[""],"projects":[]}}
Output locale: {locale}. Empty unknown fields. CV text follows:\n{text}"""


def _call_provider(text, locale):
    provider = get_string_setting('ai_provider', 'gemini')
    model = get_string_setting('ai_model', 'gemini-2.0-flash')
    prompt = _prompt(text, locale)
    if provider == 'gemini':
        key = _provider_api_key('GEMINI_API_KEY')
        if not key:
            return None
        response = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            params={'key': key},
            json={
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0},
            },
            timeout=20,
        )
        response.raise_for_status()
        return _json_from_text(response.json()['candidates'][0]['content']['parts'][0]['text'])
    if provider == 'openai':
        key = _provider_api_key('OPENAI_API_KEY')
        if not key:
            return None
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {key}'},
            json={
                'model': model,
                'messages': [{'role': 'user', 'content': prompt}],
                'temperature': 0,
                'response_format': {'type': 'json_object'},
            },
            timeout=20,
        )
        response.raise_for_status()
        return _json_from_text(response.json()['choices'][0]['message']['content'])
    if provider == 'anthropic':
        key = _provider_api_key('ANTHROPIC_API_KEY')
        if not key:
            return None
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={'x-api-key': key, 'anthropic-version': '2023-06-01'},
            json={'model': model, 'max_tokens': 4096, 'temperature': 0, 'messages': [{'role': 'user', 'content': prompt}]},
            timeout=20,
        )
        response.raise_for_status()
        return _json_from_text(response.json()['content'][0]['text'])
    raise AiCvParseError('unsupported_ai_provider')


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
    return value if isinstance(value, str) and re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', value) else None


def _rich_text(value):
    return {
        'format': 'rich_text_v1',
        'content': [
            {'type': 'paragraph', 'text': line.strip()}
            for line in str(value or '').splitlines() if line.strip()
        ],
    }


def _canonical(payload, locale):
    content = empty_content(locale)
    personal = payload.get('personal_info', {})
    for key in ('full_name', 'headline', 'email', 'phone', 'address'):
        content['personal_info'][key] = str(personal.get(key) or '')[:500]
    content['personal_info']['links'] = [str(item)[:500] for item in personal.get('links', []) if isinstance(item, str)][:10]
    labels = {
        'vi-VN': ('Giới thiệu', 'Kinh nghiệm làm việc', 'Học vấn', 'Kỹ năng', 'Dự án'),
        'en-US': ('Summary', 'Work experience', 'Education', 'Skills', 'Projects'),
    }.get(locale, ('Summary', 'Work experience', 'Education', 'Skills', 'Projects'))
    summary = str(payload.get('summary') or '').strip()
    if summary:
        content['sections'].append({
            'instance_id': 'summary_1', 'section_key': 'summary', 'title': labels[0],
            'enabled': True, 'items': [{'item_id': 'summary_item_1', 'value': summary[:4000]}],
        })
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
            content['sections'].append({
                'instance_id': f'{section_key}_1', 'section_key': section_key,
                'title': title, 'enabled': True, 'items': items,
            })
    skills = [str(skill)[:200] for skill in payload.get('skills', []) if str(skill).strip()][:50]
    if skills:
        content['sections'].append({
            'instance_id': 'skills_1', 'section_key': 'skills', 'title': labels[3],
            'enabled': True,
            'items': [{'item_id': f'skills_item_{index + 1}', 'name': skill, 'level': ''} for index, skill in enumerate(skills)],
        })
    return content


def structure_cv_text(text, locale):
    if _setting_value('ai_enabled', True) is False:
        raise AiCvParseError('ai_disabled')
    payload = None
    for attempt in range(2):
        try:
            payload = _call_provider(text, locale)
            if payload is None:
                payload = _heuristic(text)
            _validate_payload(payload)
            break
        except (KeyError, TypeError, json.JSONDecodeError, requests.RequestException, AiCvParseError) as error:
            if attempt == 1:
                if isinstance(error, AiCvParseError):
                    raise
                raise AiCvParseError('ai_provider_failed') from error
    return _canonical(payload, locale)

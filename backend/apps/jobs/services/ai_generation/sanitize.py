"""Loại thông tin liên hệ khỏi đầu vào trước khi gửi cho model hay lưu lại.

Dữ liệu nhà tuyển dụng dán vào là không đáng tin: email, số điện thoại, link và
handle liên hệ bị thay bằng nhãn để không lọt sang prompt lẫn bản nháp.
"""

import html
import re

from django.utils.html import strip_tags
from rest_framework.exceptions import ValidationError

from ...models import JobAiGeneration

EMAIL_RE = re.compile(r'(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b')
PHONE_RE = re.compile(r'(?<!\d)(?:\+?84|0)(?:[ .()\-]*\d){8,10}(?!\d)')
URL_RE = re.compile(r'(?i)\b(?:https?://|www\.|mailto:|zalo\.me/|linkedin\.com/)[^\s<>]+')
CONTACT_HANDLE_RE = re.compile(r'(?i)\b(?:zalo|telegram|skype)\s*(?:[:@]|\bid\b)\s*[A-Z0-9._-]+')
CONTACT_LINE_RE = re.compile(
    r'(?i)^\s*(?:liên\s*hệ|contact|email|e-mail|điện\s*thoại|phone|zalo|nộp\s*hồ\s*sơ)\s*:'
)


def plain_text(value, *, max_length):
    text = strip_tags(html.unescape(str(value or '')))
    text = EMAIL_RE.sub('[email removed]', text)
    text = PHONE_RE.sub('[phone removed]', text)
    text = URL_RE.sub('[url removed]', text)
    text = CONTACT_HANDLE_RE.sub('[contact removed]', text)
    return re.sub(r'[ \t]+', ' ', text).strip()[:max_length]


def sanitize_source_text(value):
    lines = []
    for raw_line in strip_tags(html.unescape(str(value or ''))).splitlines():
        if CONTACT_LINE_RE.match(raw_line):
            continue
        line = plain_text(raw_line, max_length=2000)
        if line:
            lines.append(line)
    return '\n'.join(lines)[:20000]


def sanitize_generation_input(validated_data):
    mode = validated_data['mode']
    if mode == JobAiGeneration.Mode.JD_TEXT:
        source_text = sanitize_source_text(validated_data.get('source_text', ''))
        if not source_text:
            raise ValidationError(
                {'source_text': 'JD không còn nội dung sau khi loại thông tin liên hệ.'}
            )
        return {'source_text': source_text}

    brief = validated_data.get('brief') or {}
    sanitized = {}
    for key in ('position', 'position_level', 'employment_type', 'notes'):
        if key in brief:
            sanitized[key] = plain_text(
                brief[key],
                max_length=2000 if key == 'notes' else 255,
            )
    sanitized['work_types'] = list(brief.get('work_types') or [])
    for key in ('responsibilities', 'requirements', 'preferred_skills'):
        sanitized[key] = [
            plain_text(item, max_length=120) for item in brief.get(key, []) if str(item).strip()
        ][:10]
    if not sanitized.get('position'):
        raise ValidationError({'brief': {'position': 'Nhập vị trí cần tuyển.'}})
    return {'brief': sanitized}

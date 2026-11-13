"""Chụp trường riêng của vị trí vào section `position_details` (CVT-3).

Định nghĩa `CvPositionField` (nhãn theo ngôn ngữ, kiểu, lựa chọn) được sao vào
document lúc dựng CV. Document vì vậy tự đủ để hiển thị và kiểm tra; admin đổi
hay tắt trường sau đó không làm hỏng CV đã có. Khi ứng viên đổi vị trí, các giá
trị cùng `field_key` được giữ lại.
"""

from ..models import CvPositionField
from ..section_registry import get_section_contract

SECTION_KEY = 'position_details'
SECTION_TITLES = {'vi-VN': 'Thông tin chuyên môn', 'en-US': 'Professional details'}


def _empty_value(field_type):
    if field_type in CvPositionField.LIST_TYPES:
        return []
    if field_type in {CvPositionField.FieldType.NUMBER, CvPositionField.FieldType.DATE}:
        return None
    return ''


def position_details_section(profile, locale, *, values=None):
    """Section `position_details` (chưa có `instance_id`) hoặc `None` nếu vị trí không có trường."""
    values = values or {}
    fields = [field for field in profile.fields.all() if field.is_active]
    if not fields:
        return None
    return {
        'section_key': SECTION_KEY,
        'title': SECTION_TITLES.get(locale, get_section_contract(SECTION_KEY).display_name),
        'enabled': True,
        'items': [
            {
                'item_id': f'{SECTION_KEY}_item_{index}',
                'field_key': field.key,
                'label': field.label(locale),
                'placeholder': field.placeholder(locale),
                'field_type': field.field_type,
                'options': field.option_labels(locale),
                'maps_to': field.maps_to,
                'value': values.get(field.key, _empty_value(field.field_type)),
            }
            for index, field in enumerate(fields, start=1)
        ],
    }


def _existing_values(section):
    return {
        item.get('field_key'): item.get('value')
        for item in (section or {}).get('items', [])
        if isinstance(item, dict) and item.get('value') not in (None, '', [])
    }


def apply_position_details(content, profile, locale):
    """Đặt section `position_details` của vị trí vào nội dung, giữ giá trị cùng khóa.

    Vị trí không có trường riêng thì gỡ section cũ (nhãn của vị trí khác). Section
    mới được đặt ngay sau kỹ năng để `section_preset` có thể sắp lại.
    """
    sections = content.setdefault('sections', [])
    index = next(
        (i for i, section in enumerate(sections) if section.get('section_key') == SECTION_KEY),
        None,
    )
    current = sections[index] if index is not None else None
    section = position_details_section(profile, locale, values=_existing_values(current))
    if section is None:
        if index is not None:
            sections.pop(index)
        return content
    if current is not None:
        section['instance_id'] = current['instance_id']
        sections[index] = section
        return content
    section['instance_id'] = f'{SECTION_KEY}_1'
    after_skills = next(
        (i + 1 for i, item in enumerate(sections) if item.get('section_key') == 'skills'),
        len(sections),
    )
    sections.insert(after_skills, section)
    return content

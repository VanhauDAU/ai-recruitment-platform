"""Canonical, template-agnostic CV section definitions.

The database mirrors this registry in ``CvSectionDefinition`` so administrators
can configure a template without making the template the owner of content
semantics.  Adding a new system section is an intentional product/schema
change, not an ad-hoc template conditional.
"""

from copy import deepcopy
from dataclasses import dataclass


@dataclass(frozen=True)
class SectionContract:
    key: str
    display_name: str
    allow_multiple: bool = False
    requires_items: bool = True
    initial_item: bool = True
    deletable: bool = True
    personal_info_backed: bool = False


SECTION_REGISTRY = {
    contract.key: contract
    for contract in (
        SectionContract('summary', 'Giới thiệu', requires_items=False),
        SectionContract('experience', 'Kinh nghiệm làm việc', allow_multiple=True),
        SectionContract('education', 'Học vấn', allow_multiple=True),
        SectionContract('skills', 'Kỹ năng'),
        SectionContract('projects', 'Dự án', allow_multiple=True),
        SectionContract('certifications', 'Chứng chỉ', allow_multiple=True),
        SectionContract('languages', 'Ngôn ngữ'),
        SectionContract('awards', 'Giải thưởng', allow_multiple=True),
        SectionContract('custom', 'Nội dung tùy chỉnh', allow_multiple=True, requires_items=False),
        SectionContract('activities', 'Hoạt động', allow_multiple=True),
        SectionContract('references', 'Người tham chiếu', allow_multiple=True),
        SectionContract('interests', 'Sở thích'),
        # CVT-3. Mỗi item là một trường riêng của vị trí, định nghĩa được chụp
        # vào document lúc tạo CV (apps/cv_templates/services/position_fields.py).
        SectionContract(
            'position_details',
            'Thông tin chuyên môn',
            requires_items=False,
            initial_item=False,
        ),
        SectionContract('portfolio', 'Portfolio'),
        SectionContract('publications', 'Công bố'),
        SectionContract(
            'nameplate',
            'Danh thiếp',
            requires_items=False,
            initial_item=False,
            deletable=False,
            personal_info_backed=True,
        ),
        SectionContract(
            'contact',
            'Thông tin liên hệ',
            requires_items=False,
            initial_item=False,
            deletable=False,
            personal_info_backed=True,
        ),
        SectionContract(
            'avatar',
            'Ảnh đại diện',
            requires_items=False,
            initial_item=False,
            personal_info_backed=True,
        ),
    )
}


# Tên mục tiếng Anh và khung item trống, dùng khi hệ thống tự thêm một mục vào CV
# (bộ mục của vị trí, CVT-4). Khung item khớp `defaultItem` ở frontend
# (entities/cv/model/document.js) để editor hiện đúng các ô nhập.
SECTION_TITLES_EN = {
    'summary': 'Career objective',
    'experience': 'Work experience',
    'education': 'Education',
    'skills': 'Skills',
    'projects': 'Projects',
    'certifications': 'Certifications',
    'languages': 'Languages',
    'awards': 'Awards',
    'activities': 'Activities',
    'references': 'References',
    'interests': 'Interests',
    'portfolio': 'Portfolio',
    'publications': 'Publications',
}
_RICH_TEXT = {'format': 'rich_text_v1', 'content': []}
_BLANK_ITEMS = {
    'summary': {'value': ''},
    'experience': {
        'role': '',
        'company': '',
        'start_date': None,
        'end_date': None,
        'description': _RICH_TEXT,
    },
    'education': {
        'degree': '',
        'institution': '',
        'start_date': None,
        'end_date': None,
        'description': _RICH_TEXT,
    },
    'skills': {'name': '', 'level': ''},
    'projects': {'name': '', 'role': '', 'description': _RICH_TEXT},
    'certifications': {'name': '', 'issuer': '', 'description': _RICH_TEXT},
    'publications': {'title': '', 'organization': '', 'value': '', 'description': _RICH_TEXT},
}
_DEFAULT_BLANK_ITEM = {'name': '', 'value': '', 'description': _RICH_TEXT}


def blank_section(section_key, locale, instance_id):
    """Một mục trống (một item để điền) cho CV ở ngôn ngữ `locale`."""
    contract = SECTION_REGISTRY[section_key]
    title = SECTION_TITLES_EN.get(section_key) if locale == 'en-US' else None
    return {
        'instance_id': instance_id,
        'section_key': section_key,
        'title': title or contract.display_name,
        'enabled': True,
        'items': [
            {
                'item_id': f'{section_key}_item_1',
                **deepcopy(_BLANK_ITEMS.get(section_key, _DEFAULT_BLANK_ITEM)),
            }
        ],
    }


def get_section_contract(section_key):
    """Return the registered content contract, or ``None`` for an unknown key."""
    return SECTION_REGISTRY.get(section_key)


def section_definition_seed_data():
    """Stable seed data used by migrations and management tooling."""
    return [
        {
            'section_key': contract.key,
            'display_name': contract.display_name,
            'data_schema': {
                'schema_version': 1,
                'item_id_required': contract.requires_items,
                'initial_item': contract.initial_item,
                'deletable': contract.deletable,
                'personal_info_backed': contract.personal_info_backed,
            },
            'allow_multiple': contract.allow_multiple,
            'is_system': True,
            'is_active': True,
            'schema_version': 1,
        }
        for contract in SECTION_REGISTRY.values()
    ]

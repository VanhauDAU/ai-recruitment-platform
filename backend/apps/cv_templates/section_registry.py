"""Canonical, template-agnostic CV section definitions.

The database mirrors this registry in ``CvSectionDefinition`` so administrators
can configure a template without making the template the owner of content
semantics.  Adding a new system section is an intentional product/schema
change, not an ad-hoc template conditional.
"""

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
        SectionContract(
            'nameplate', 'Danh thiếp', requires_items=False, initial_item=False,
            deletable=False, personal_info_backed=True,
        ),
        SectionContract(
            'contact', 'Thông tin liên hệ', requires_items=False, initial_item=False,
            personal_info_backed=True,
        ),
        SectionContract(
            'avatar', 'Ảnh đại diện', requires_items=False, initial_item=False,
            personal_info_backed=True,
        ),
    )
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

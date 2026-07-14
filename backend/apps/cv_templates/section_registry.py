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
            },
            'allow_multiple': contract.allow_multiple,
            'is_system': True,
            'is_active': True,
            'schema_version': 1,
        }
        for contract in SECTION_REGISTRY.values()
    ]

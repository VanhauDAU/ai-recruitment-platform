"""Canonical blocks and accent palette of the public company page.

The backend owns this registry and serves it through the page read model, so
the frontend renders by ``type`` and never keeps its own copy of the layout.
"""

from dataclasses import dataclass

from .page_content import (
    BENEFIT_LIMIT,
    GALLERY_LIMIT,
    HEADLINE_MAX_LENGTH,
    OFFICE_LIMIT,
    SOCIAL_NETWORKS,
)


@dataclass(frozen=True)
class PageSection:
    key: str
    type: str
    title: str
    # Always-on blocks render even without company content and cannot be hidden.
    always_on: bool = False


# Main column, in default order.
MAIN_SECTIONS = (
    PageSection('about', 'rich_text', 'Giới thiệu công ty'),
    PageSection('jobs', 'jobs', 'Việc làm đang tuyển', always_on=True),
    PageSection('benefits', 'benefits', 'Phúc lợi'),
    PageSection('culture', 'rich_text', 'Văn hoá công ty'),
    PageSection('gallery', 'gallery', 'Hình ảnh công ty'),
    PageSection('video', 'video', 'Video giới thiệu'),
)

# Sidebar, in fixed order.
SIDEBAR_SECTIONS = (
    PageSection('general_info', 'facts', 'Thông tin chung', always_on=True),
    PageSection('offices', 'offices', 'Địa điểm'),
    PageSection('social_links', 'social_links', 'Mạng xã hội'),
    PageSection('share', 'share', 'Chia sẻ công ty', always_on=True),
    PageSection('similar_companies', 'similar_companies', 'Công ty cùng lĩnh vực', always_on=True),
)

# Every block a visitor can point at, e.g. when reporting wrong information.
SECTION_TITLES = {section.key: section.title for section in MAIN_SECTIONS + SIDEBAR_SECTIONS}

MAIN_SECTION_KEYS = tuple(section.key for section in MAIN_SECTIONS)
# Blocks an editor may switch off, in either zone.
HIDEABLE_SECTION_KEYS = frozenset(
    section.key for section in MAIN_SECTIONS + SIDEBAR_SECTIONS if not section.always_on
)
PINNED_JOB_LIMIT = 3

DEFAULT_ACCENT_KEY = 'brand'

# Decorative accents only. ``brand`` is the platform colour; every other
# ``primary`` keeps white text at WCAG AA contrast (>= 4.5:1).
ACCENT_PALETTE = {
    'brand': {'primary': '#00b14f', 'hover': '#008a3e', 'soft': '#f0fbf5'},
    'ocean': {'primary': '#0369a1', 'hover': '#075985', 'soft': '#f0f9ff'},
    'indigo': {'primary': '#4338ca', 'hover': '#3730a3', 'soft': '#eef2ff'},
    'violet': {'primary': '#6d28d9', 'hover': '#5b21b6', 'soft': '#f5f3ff'},
    'rose': {'primary': '#be123c', 'hover': '#9f1239', 'soft': '#fff1f2'},
    'orange': {'primary': '#c2410c', 'hover': '#9a3412', 'soft': '#fff7ed'},
    'teal': {'primary': '#0f766e', 'hover': '#115e59', 'soft': '#f0fdfa'},
    'slate': {'primary': '#334155', 'hover': '#1e293b', 'soft': '#f8fafc'},
}

ACCENT_LABELS = {
    'brand': 'Xanh ProCV',
    'ocean': 'Xanh đại dương',
    'indigo': 'Chàm',
    'violet': 'Tím',
    'rose': 'Đỏ hồng',
    'orange': 'Cam',
    'teal': 'Xanh ngọc',
    'slate': 'Xám đá',
}


def resolve_section_order(stored):
    """Main-zone order to render: the saved order reconciled with the registry.

    Saved keys the registry no longer has are dropped and blocks added to the
    registry later keep their default position after the saved ones, so a
    registry change never needs a data migration.
    """
    known = [key for key in stored if key in MAIN_SECTION_KEYS]
    return [*known, *(key for key in MAIN_SECTION_KEYS if key not in known)]


def company_page_registry():
    """What an editor can arrange, as served to the employer workspace."""
    zones = (('main', MAIN_SECTIONS), ('sidebar', SIDEBAR_SECTIONS))
    return {
        'sections': [
            {
                'key': section.key,
                'title': section.title,
                'zone': zone,
                'always_on': section.always_on,
            }
            for zone, sections in zones
            for section in sections
        ],
        'accents': [
            {'key': key, 'label': ACCENT_LABELS[key], **colours}
            for key, colours in ACCENT_PALETTE.items()
        ],
        'social_networks': [
            {'key': network.key, 'label': network.label, 'placeholder': network.placeholder}
            for network in SOCIAL_NETWORKS
        ],
        'limits': {
            'pinned_jobs': PINNED_JOB_LIMIT,
            'benefits': BENEFIT_LIMIT,
            'offices': OFFICE_LIMIT,
            'gallery': GALLERY_LIMIT,
            'headline': HEADLINE_MAX_LENGTH,
        },
    }

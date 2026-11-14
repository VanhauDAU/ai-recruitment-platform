"""Canonical blocks and accent palette of the public company page.

The backend owns this registry and serves it through the page read model, so
the frontend renders by ``type`` and never keeps its own copy of the layout.
"""

from dataclasses import dataclass


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
    PageSection('benefits', 'rich_text', 'Phúc lợi'),
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

"""Cách đặt section mặc định theo từng layout (dữ liệu thuần).

Seed catalogue và cổng admin (tạo mẫu mới, đổi bố cục) dùng chung bản đồ này,
nên mẫu tạo từ admin có sẵn bố cục hợp lý giống mẫu seed.
"""

# Canonical section keys ordered per region, per layout. Every layout places
# ``nameplate`` and ``contact`` in a region (there is no hard-coded header), and
# layouts that support a photo also place ``avatar``.
_MAIN_STORY = (
    'summary',
    'experience',
    'education',
    'projects',
    'portfolio',
    'publications',
    'activities',
    'awards',
)
_SIDE_FACTS = ('skills', 'position_details', 'certifications', 'languages', 'interests')
_TAIL = ('references', 'custom')

SECTION_PLANS = {
    'single_column_v1': {
        'main': (
            'nameplate',
            'contact',
            *_MAIN_STORY[:3],
            'skills',
            'position_details',
            *_MAIN_STORY[3:],
            'certifications',
            'languages',
            'interests',
            *_TAIL,
        ),
    },
    'single_column_photo_v1': {
        'header': ('avatar', 'nameplate', 'contact'),
        'main': (
            *_MAIN_STORY[:3],
            'skills',
            'position_details',
            *_MAIN_STORY[3:],
            'certifications',
            'languages',
            'interests',
            *_TAIL,
        ),
    },
    'sidebar_left_v1': {
        'sidebar': ('nameplate', 'contact', *_SIDE_FACTS),
        'main': (*_MAIN_STORY, *_TAIL),
    },
    'sidebar_left_photo_v1': {
        'sidebar': ('avatar', 'nameplate', 'contact', *_SIDE_FACTS),
        'main': (*_MAIN_STORY, *_TAIL),
    },
    'sidebar_right_v1': {
        'main': ('nameplate', 'contact', *_MAIN_STORY, *_TAIL),
        'sidebar': ('avatar', *_SIDE_FACTS),
    },
    'header_band_two_column_v1': {
        'header': ('avatar', 'nameplate', 'contact'),
        'main': (*_MAIN_STORY, *_TAIL),
        'sidebar': _SIDE_FACTS,
    },
    'timeline_v1': {
        'header': ('avatar', 'nameplate', 'contact'),
        'main': (
            *_MAIN_STORY[:3],
            'skills',
            'position_details',
            *_MAIN_STORY[3:],
            'certifications',
            'languages',
            'interests',
            *_TAIL,
        ),
    },
    'compact_two_column_v1': {
        'header': ('nameplate', 'contact'),
        'left': (
            'summary',
            'experience',
            'projects',
            'portfolio',
            'publications',
            'activities',
            *_TAIL,
        ),
        'right': (
            'education',
            'skills',
            'position_details',
            'certifications',
            'languages',
            'awards',
            'interests',
        ),
    },
}

REQUIRED_SECTIONS = frozenset({'experience', 'education', 'skills', 'nameplate', 'contact'})
DEFAULT_ENABLED_SECTIONS = frozenset(
    {'summary', 'experience', 'education', 'skills', 'nameplate', 'contact'}
)
# Personal-info backed markers render values, never a section heading.
PERSONAL_INFO_SECTIONS = frozenset({'avatar', 'nameplate', 'contact'})

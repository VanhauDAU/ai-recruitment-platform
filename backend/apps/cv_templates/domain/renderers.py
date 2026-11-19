"""Registry layout CV (CVT-2).

Mỗi layout là dữ liệu thuần trong `layouts.json` — vùng, hàng, độ rộng mặc định,
tông nền, cách xếp và biến thể — không chứa component, CSS hay code. Frontend
giữ bản sao `entities/cv/model/cv-layouts.json` (một test frontend so sánh hai
bản) và render mọi layout bằng một renderer chung; PDF dùng đúng renderer đó.

`CvTemplateVersion.renderer_key` lưu khóa layout. Chỉ khóa có trong registry
mới được lưu vào template version.
"""

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from django.core.exceptions import ValidationError

LAYOUTS_FILE = Path(__file__).with_name('layouts.json')
SUPPORTED_SCHEMA_VERSIONS = frozenset({1})
LAYOUT_VERSION = '1'


@dataclass(frozen=True)
class LayoutRegion:
    id: str
    row: int
    width: int
    tone: str
    arrange: str


@dataclass(frozen=True)
class RendererContract:
    key: str
    label: str
    avatar: bool
    variant: str
    resize: dict | None
    regions: tuple[LayoutRegion, ...]
    version: str = LAYOUT_VERSION
    supported_schema_versions: frozenset[int] = SUPPORTED_SCHEMA_VERSIONS

    @property
    def allowed_regions(self):
        return frozenset(region.id for region in self.regions)

    @property
    def region_order(self):
        return tuple(region.id for region in self.regions)

    def default_regions(self):
        """`layout_json.regions` mặc định của layout, chưa gán section."""
        return [
            {
                'id': region.id,
                'row': region.row,
                'width_percent': region.width,
                'section_instance_ids': [],
            }
            for region in self.regions
        ]

    def capabilities(self):
        """Giới hạn trình bày mà mọi writer canonical kiểm tra."""
        multi_region = len(self.regions) > len({region.row for region in self.regions})
        resize = (
            {'enabled': True, 'min_percent': self.resize['min'], 'max_percent': self.resize['max']}
            if self.resize
            else {'enabled': False}
        )
        return {
            'layout': {
                'section_drag': True,
                'cross_region_drag': len(self.regions) > 1,
                'item_drag': True,
                'column_resize': resize if multi_region else {'enabled': False},
            },
            'supports_regions': list(self.region_order),
        }


@cache
def layout_registry():
    raw = json.loads(LAYOUTS_FILE.read_text(encoding='utf-8'))
    return {
        key: RendererContract(
            key=key,
            label=spec['label'],
            avatar=spec['avatar'],
            variant=spec['variant'],
            resize=spec['resize'],
            regions=tuple(LayoutRegion(**region) for region in spec['regions']),
        )
        for key, spec in raw.items()
    }


def get_renderer_contract(renderer_key):
    return layout_registry().get(renderer_key)


def validate_renderer_contract(renderer_key, schema_version, regions=None):
    """Validate a renderer-independent document against a deployed layout."""
    contract = get_renderer_contract(renderer_key)
    if contract is None:
        raise ValidationError({'renderer_key': f'Unsupported renderer: {renderer_key}.'})
    if schema_version not in contract.supported_schema_versions:
        raise ValidationError({'schema_version': 'Renderer does not support this schema version.'})
    if regions is not None:
        unknown_regions = set(regions).difference(contract.allowed_regions)
        if unknown_regions:
            raise ValidationError(
                {'regions': f'Unsupported renderer regions: {sorted(unknown_regions)}.'}
            )
    return contract

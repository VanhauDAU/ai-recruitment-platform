"""Cấu hình phiên bản template từ wizard admin (CVT-4) và seed catalogue.

Phiên bản nháp được dựng từ registry layout (`layouts.json`): admin chỉ chọn
layout, độ rộng cột, phong cách và cách đặt section vào vùng — không sửa JSON.
Phiên bản đã xuất bản là bất biến; muốn đổi thì tạo bản nháp mới.
"""

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.cvs.schemas import CV_FONT_FAMILIES, HEX_COLOR_RE, empty_layout, empty_style

from ..models import (
    CvColor,
    CvSectionDefinition,
    CvTemplateColorLink,
    CvTemplateSection,
    CvTemplateVersion,
)
from ..renderers import get_renderer_contract
from ..section_plans import (
    DEFAULT_ENABLED_SECTIONS,
    PERSONAL_INFO_SECTIONS,
    REQUIRED_SECTIONS,
    SECTION_PLANS,
)

IDENTITY_SECTIONS = ('nameplate', 'contact')
# Section của nội dung mẫu phổ biến; phiên bản phải đặt chúng vào một vùng.
CORE_SECTIONS = ('summary', 'experience', 'education', 'skills')
FONT_SCALE_RANGE = (0.85, 1.15)
LINE_HEIGHT_RANGE = (1.2, 1.8)


def layout_regions(layout_key, side_percent=None):
    """Vùng của layout; ``side_percent`` đổi độ rộng cột phụ của hàng hai cột."""
    regions = get_renderer_contract(layout_key).default_regions()
    rows = {}
    for region in regions:
        rows.setdefault(region['row'], []).append(region)
    for row in rows.values():
        if side_percent and len(row) == 2:
            primary, secondary = sorted(row, key=lambda region: -region['width_percent'])
            secondary['width_percent'] = side_percent
            primary['width_percent'] = 100 - side_percent
    return regions


def layout_capabilities(layout_key):
    return get_renderer_contract(layout_key).capabilities()


def new_version_defaults(renderer_key):
    """Cấu hình khởi đầu của phiên bản đầu tiên: vùng mặc định của layout, style trống."""
    if get_renderer_contract(renderer_key) is None:
        raise ValidationError({'renderer_key': 'Layout không tồn tại.'})
    regions = layout_regions(renderer_key)
    layout = empty_layout()
    layout['regions'] = [{**region, 'section_instance_ids': []} for region in regions]
    return {
        'renderer_key': renderer_key,
        'renderer_version': '1',
        'schema_version': 1,
        'default_layout_json': layout,
        'default_style_json': empty_style(),
        'capabilities': layout_capabilities(renderer_key),
    }


def planned_sections(renderer_key, keep=None):
    """Cách đặt section mặc định của layout (cùng bản đồ seed dùng).

    ``keep`` là section đang có của phiên bản (``{key: {is_required,
    is_default_enabled}}``): khi đổi layout, chỉ giữ các section đó (cộng tên,
    liên hệ, ảnh nếu layout có) và giữ cờ admin đã chỉnh.
    """
    plan = [(region, key) for region, keys in SECTION_PLANS[renderer_key].items() for key in keys]
    if keep:
        plan = [
            (region, key) for region, key in plan if key in keep or key in PERSONAL_INFO_SECTIONS
        ]
    return [
        {
            'section_key': key,
            'region_key': region,
            **(keep or {}).get(
                key,
                {
                    'is_required': key in REQUIRED_SECTIONS,
                    'is_default_enabled': key in DEFAULT_ENABLED_SECTIONS,
                },
            ),
        }
        for region, key in plan
    ]


def _require_draft(version):
    if version.version_status != CvTemplateVersion.VersionStatus.DRAFT:
        raise ValidationError({'version': 'Chỉ sửa được phiên bản nháp.'})


def _regions_with_widths(renderer_key, widths):
    contract = get_renderer_contract(renderer_key)
    regions = contract.default_regions()
    if not widths:
        return regions
    if set(widths) - {region['id'] for region in regions}:
        raise ValidationError({'widths': 'Có vùng không thuộc layout.'})
    rows = {}
    for region in regions:
        rows.setdefault(region['row'], []).append(region)
    for row in rows.values():
        # Vùng chiếm cả hàng luôn rộng 100%; chỉ hàng nhiều cột nhận độ rộng.
        if len(row) > 1:
            for region in row:
                region['width_percent'] = int(widths.get(region['id'], region['width_percent']))
    for row in rows.values():
        if sum(region['width_percent'] for region in row) != 100:
            raise ValidationError({'widths': 'Tổng độ rộng các cột cùng hàng phải là 100%.'})
        if (
            len(row) > 1
            and contract.resize
            and any(
                not contract.resize['min'] <= region['width_percent'] <= contract.resize['max']
                for region in row
            )
        ):
            raise ValidationError(
                {
                    'widths': f'Độ rộng cột phải trong khoảng {contract.resize["min"]}–'
                    f'{contract.resize["max"]}%.'
                }
            )
    return regions


def _validated_style(style, current):
    merged = {**(current or empty_style()), **(style or {})}
    if merged.get('font_family') not in CV_FONT_FAMILIES:
        raise ValidationError({'style.font_family': 'Font không được hỗ trợ.'})
    if not HEX_COLOR_RE.fullmatch(str(merged.get('theme_color', ''))):
        raise ValidationError({'style.theme_color': 'Màu phải dạng #RRGGBB.'})
    for key, (low, high) in (('font_scale', FONT_SCALE_RANGE), ('line_height', LINE_HEIGHT_RANGE)):
        value = merged.get(key)
        if not isinstance(value, (int, float)) or not low <= value <= high:
            raise ValidationError({f'style.{key}': f'Phải trong khoảng {low}–{high}.'})
    return merged


def replace_sections(version, sections, region_ids):
    definitions = {
        definition.section_key: definition
        for definition in CvSectionDefinition.objects.filter(
            section_key__in=[entry.get('section_key') for entry in sections]
        )
    }
    keys = [entry.get('section_key') for entry in sections]
    if len(keys) != len(set(keys)) or set(keys) - set(definitions):
        raise ValidationError({'sections': 'Section không hợp lệ hoặc bị lặp.'})
    if any(entry.get('region_key') not in region_ids for entry in sections):
        raise ValidationError({'sections': 'Section phải nằm trong một vùng của layout.'})
    missing = [key for key in IDENTITY_SECTIONS if key not in keys]
    if missing:
        raise ValidationError({'sections': f'Thiếu section bắt buộc: {", ".join(missing)}.'})
    version.sections.all().delete()
    CvTemplateSection.objects.bulk_create(
        [
            CvTemplateSection(
                template_version=version,
                section_definition=definitions[entry['section_key']],
                region_key=entry['region_key'],
                default_order=order,
                is_required=bool(entry.get('is_required', False)),
                is_default_enabled=bool(entry.get('is_default_enabled', True)),
                use_theme_color=entry['section_key'] not in PERSONAL_INFO_SECTIONS,
            )
            for order, entry in enumerate(sections)
        ]
    )


@transaction.atomic
def configure_version(version, *, renderer_key=None, widths=None, style=None, sections=None):
    """Cập nhật phiên bản nháp: layout, độ rộng cột, phong cách, section theo vùng.

    Đổi layout mà không gửi `sections` thì section được xếp lại theo bản đồ mặc
    định của layout mới (giữ các section và cờ đang có).
    """
    version = CvTemplateVersion.objects.select_for_update().get(pk=version.pk)
    _require_draft(version)
    key = renderer_key or version.renderer_key
    layout_changed = key != version.renderer_key
    current_widths = {
        region['id']: region['width_percent']
        for region in (version.default_layout_json or {}).get('regions', [])
    }
    regions = _regions_with_widths(
        key,
        widths if widths is not None else (current_widths if key == version.renderer_key else None),
    )
    layout = empty_layout()
    layout['regions'] = [{**region, 'section_instance_ids': []} for region in regions]
    version.renderer_key = key
    version.default_layout_json = layout
    version.capabilities = layout_capabilities(key)
    version.default_style_json = _validated_style(style, version.default_style_json)
    version.save(
        update_fields=['renderer_key', 'default_layout_json', 'capabilities', 'default_style_json']
    )
    region_ids = [region['id'] for region in regions]
    if sections is not None:
        replace_sections(version, sections, region_ids)
    elif layout_changed:
        keep = {
            section.section_definition.section_key: {
                'is_required': section.is_required,
                'is_default_enabled': section.is_default_enabled,
            }
            for section in version.sections.select_related('section_definition')
        }
        replace_sections(version, planned_sections(key, keep), region_ids)
    return version


def publish_checklist(template, version, *, test_pdf_ok):
    """Điều kiện xuất bản; mỗi mục `{key, ok, label}`."""
    links = list(template.color_links.select_related('color'))
    placed = set(version.sections.values_list('section_definition__section_key', flat=True))
    return [
        {
            'key': 'names',
            'ok': bool(template.display_name_vi and template.display_name_en),
            'label': 'Có tên tiếng Việt và tiếng Anh',
        },
        {
            'key': 'colors',
            'ok': any(link.color.is_active for link in links)
            and any(link.is_default for link in links),
            'label': 'Có ít nhất một màu và một màu mặc định',
        },
        {
            'key': 'identity',
            'ok': set(IDENTITY_SECTIONS) <= placed,
            'label': 'Tên và thông tin liên hệ được đặt vào một vùng',
        },
        {
            'key': 'core_sections',
            'ok': set(CORE_SECTIONS) <= placed,
            'label': 'Mục tiêu, kinh nghiệm, học vấn, kỹ năng không bị ẩn',
        },
        {
            'key': 'test_pdf',
            'ok': test_pdf_ok,
            'label': 'Đã xuất PDF thử thành công cho phiên bản này',
        },
    ]


@transaction.atomic
def set_template_colors(template, color_public_ids, default_public_id):
    """Đặt danh sách màu (theo thứ tự) và màu mặc định; giữ ảnh của màu còn dùng."""
    if not color_public_ids or default_public_id not in color_public_ids:
        raise ValidationError(
            {'colors': 'Chọn ít nhất một màu và màu mặc định nằm trong danh sách.'}
        )
    colors = {
        color.public_id: color
        for color in CvColor.objects.filter(public_id__in=color_public_ids, is_active=True)
    }
    if len(colors) != len(set(color_public_ids)):
        raise ValidationError({'colors': 'Có màu không tồn tại hoặc đã tắt.'})
    template.color_links.exclude(color__public_id__in=color_public_ids).delete()
    # Bỏ cờ mặc định trước để ràng buộc "một màu mặc định" không vướng khi đổi.
    template.color_links.update(is_default=False)
    existing = {link.color.public_id: link for link in template.color_links.select_related('color')}
    for order, public_id in enumerate(color_public_ids):
        link = existing.get(public_id) or CvTemplateColorLink(
            template=template, color=colors[public_id]
        )
        link.sort_order = order
        link.is_default = public_id == default_public_id
        link.save()
    return template

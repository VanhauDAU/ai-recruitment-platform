"""Validation and normalization for the canonical CV document contract.

The contract deliberately separates user content from layout and style.  It is
used before saving mutable drafts and immutable versions, independently of any
particular CV template or UI renderer.
"""

from copy import deepcopy
import json
import re

from django.core.exceptions import ValidationError

from apps.cv_templates.section_registry import get_section_contract


CANONICAL_SCHEMA_VERSION = 1
MAX_DOCUMENT_BYTES = 256 * 1024
ALLOWED_FONT_FAMILIES = frozenset({'Arial', 'Calibri', 'Inter', 'Roboto', 'Source Sans Pro'})
HEX_COLOR_RE = re.compile(r'^#[0-9A-Fa-f]{6}$')
YEAR_MONTH_RE = re.compile(r'^\d{4}-(0[1-9]|1[0-2])$')
SAFE_RICH_TEXT_TYPES = frozenset({'bullet', 'paragraph'})
SAFE_RICH_TEXT_MARKS = frozenset(
    {
        'bold',
        'italic',
        'underline',
        'font_family',
        'font_size_pt',
        'color',
    }
)


def empty_content(locale='vi-VN'):
    return {
        'schema_version': CANONICAL_SCHEMA_VERSION,
        'locale': locale,
        'personal_info': {
            'full_name': '',
            'headline': '',
            'email': '',
            'phone': '',
            'address': '',
            'website': '',
            'date_of_birth': '',
            'avatar_asset_id': None,
            'links': [],
        },
        'sections': [],
        'custom_fields': {},
    }


def empty_layout():
    return {
        'schema_version': CANONICAL_SCHEMA_VERSION,
        'page': {'size': 'A4', 'margin_mm': 12},
        'regions': [
            {'id': 'main', 'width_percent': 100, 'section_instance_ids': []},
        ],
    }


def empty_style():
    return {
        'schema_version': CANONICAL_SCHEMA_VERSION,
        'theme_color': '#00A66A',
        'font_family': 'Roboto',
        'font_scale': 1.0,
        'line_height': 1.4,
        'background_asset_id': None,
        'section_overrides': {},
    }


def canonicalize_legacy_cv_data(cv_data, style_config=None, locale='vi-VN'):
    """Convert the legacy builder payload into a valid V1 canonical document.

    This adapter is intentionally a migration boundary.  New editor code must
    submit the canonical three-document contract directly.
    """
    legacy = cv_data if isinstance(cv_data, dict) else {}
    if legacy.get('schema_version') == CANONICAL_SCHEMA_VERSION and 'sections' in legacy:
        content = deepcopy(legacy)
    else:
        content = empty_content(legacy.get('locale', locale))
        personal_info = legacy.get('personal_info', legacy.get('personal', {}))
        if isinstance(personal_info, dict):
            content['personal_info'].update(
                {
                    key: personal_info.get(key, content['personal_info'][key])
                    for key in content['personal_info']
                }
            )
        for section_key in (
            'summary',
            'experience',
            'education',
            'skills',
            'projects',
            'certifications',
            'languages',
            'awards',
        ):
            legacy_items = legacy.get(section_key)
            if not legacy_items:
                continue
            items = legacy_items if isinstance(legacy_items, list) else [legacy_items]
            content['sections'].append(
                {
                    'instance_id': f'legacy_{section_key}_1',
                    'section_key': section_key,
                    'title': section_key.replace('_', ' ').title(),
                    'enabled': True,
                    'items': [
                        dict(item, item_id=item.get('item_id', f'legacy_{section_key}_{index + 1}'))
                        if isinstance(item, dict)
                        else {'item_id': f'legacy_{section_key}_{index + 1}', 'value': str(item)}
                        for index, item in enumerate(items)
                    ],
                }
            )
    content.setdefault('schema_version', CANONICAL_SCHEMA_VERSION)
    content.setdefault('locale', locale)
    content.setdefault('personal_info', empty_content(locale)['personal_info'])
    content.setdefault('sections', [])
    content.setdefault('custom_fields', {})
    return content, empty_layout(), _canonical_style(style_config)


def _canonical_style(style_config):
    style = empty_style()
    if not isinstance(style_config, dict):
        return style
    legacy_theme_color = style_config.get('theme_color', style_config.get('color'))
    if isinstance(legacy_theme_color, str) and HEX_COLOR_RE.fullmatch(legacy_theme_color):
        style['theme_color'] = legacy_theme_color
    if style_config.get('font_family') in ALLOWED_FONT_FAMILIES:
        style['font_family'] = style_config['font_family']
    for key in ('font_scale', 'line_height', 'background_asset_id', 'section_overrides'):
        if key in style_config:
            style[key] = style_config[key]
    return style


def validate_cv_document(*, content_json, layout_json, style_json, schema_version):
    """Raise ``ValidationError`` if a canonical CV document is unsafe or invalid."""
    errors = {}
    if schema_version != CANONICAL_SCHEMA_VERSION:
        errors['schema_version'] = 'Unsupported canonical CV schema version.'
    _validate_json_size(content_json, 'content_json', errors)
    _validate_json_size(layout_json, 'layout_json', errors)
    _validate_json_size(style_json, 'style_json', errors)
    _validate_content(content_json, errors)
    _validate_layout(layout_json, content_json, errors)
    _validate_style(style_json, errors)
    if errors:
        raise ValidationError(errors)


def validate_template_layout_capabilities(*, layout_json, capabilities):
    """Enforce declared presentation limits without coupling to a renderer.

    Template versions may opt into a resizable multi-column layout.  The
    canonical schema remains renderer-agnostic, while this narrow validator
    makes the template's published min/max percentages authoritative for all
    V2 writers, not only the browser slider.
    """
    layout_capabilities = capabilities.get('layout', {}) if isinstance(capabilities, dict) else {}
    resize = (
        layout_capabilities.get('column_resize') if isinstance(layout_capabilities, dict) else None
    )
    if not isinstance(resize, dict) or resize.get('enabled') is not True:
        return
    minimum = resize.get('min_percent')
    maximum = resize.get('max_percent')
    if (
        not isinstance(minimum, (int, float))
        or not isinstance(maximum, (int, float))
        or not 0 < minimum <= maximum < 100
    ):
        raise ValidationError(
            {'template_capabilities': 'column_resize requires valid min_percent and max_percent.'}
        )
    regions = layout_json.get('regions', []) if isinstance(layout_json, dict) else []
    rows = {}
    for region in regions:
        if not isinstance(region, dict):
            continue
        rows.setdefault(region.get('row', 0), []).append(region)
    resizable_regions = [region for row in rows.values() if len(row) > 1 for region in row]
    if not resizable_regions or any(
        not minimum <= region.get('width_percent', 0) <= maximum for region in resizable_regions
    ):
        raise ValidationError(
            {
                'layout_json.regions': f'Column widths must stay between {minimum} and {maximum} percent for this template.',
            }
        )


def _validate_json_size(value, field, errors):
    try:
        encoded = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    except (TypeError, ValueError):
        errors[field] = 'Must be JSON serializable.'
        return
    if len(encoded) > MAX_DOCUMENT_BYTES:
        errors[field] = f'Must not exceed {MAX_DOCUMENT_BYTES} bytes.'


def _validate_content(content, errors):
    if not isinstance(content, dict):
        errors['content_json'] = 'Must be an object.'
        return
    if content.get('schema_version') != CANONICAL_SCHEMA_VERSION:
        errors['content_json.schema_version'] = 'Must be 1.'
    if not isinstance(content.get('locale'), str) or not content['locale']:
        errors['content_json.locale'] = 'Locale is required.'
    personal_info = content.get('personal_info')
    if not isinstance(personal_info, dict):
        errors['content_json.personal_info'] = 'Must be an object.'
    else:
        if not isinstance(personal_info.get('links', []), list):
            errors['content_json.personal_info.links'] = 'Must be a list.'
        if 'avatar_position' in personal_info:
            position = personal_info['avatar_position']
            if not isinstance(position, dict) or any(
                key not in position
                or not isinstance(position[key], (int, float))
                or not 0 <= position[key] <= 100
                for key in ('x', 'y')
            ):
                errors['content_json.personal_info.avatar_position'] = (
                    'Must contain x and y between 0 and 100.'
                )
        if 'avatar_size_mm' in personal_info:
            size = personal_info['avatar_size_mm']
            if not isinstance(size, (int, float)) or isinstance(size, bool) or not 20 <= size <= 80:
                errors['content_json.personal_info.avatar_size_mm'] = (
                    'Must be between 20 and 80 millimeters.'
                )
        if 'avatar_zoom' in personal_info:
            zoom = personal_info['avatar_zoom']
            if not isinstance(zoom, (int, float)) or isinstance(zoom, bool) or not 1 <= zoom <= 3:
                errors['content_json.personal_info.avatar_zoom'] = 'Must be between 1 and 3.'
    _validate_inline_text_styles(content.get('inline_text_styles', {}), errors)
    sections = content.get('sections')
    if not isinstance(sections, list):
        errors['content_json.sections'] = 'Must be a list.'
        return
    instance_ids = set()
    item_ids = set()
    section_counts = {}
    for index, section in enumerate(sections):
        path = f'content_json.sections[{index}]'
        if not isinstance(section, dict):
            errors[path] = 'Must be an object.'
            continue
        instance_id = section.get('instance_id')
        if not isinstance(instance_id, str) or not instance_id:
            errors[f'{path}.instance_id'] = 'A stable instance_id is required.'
        elif instance_id in instance_ids:
            errors[f'{path}.instance_id'] = 'Duplicate section instance_id.'
        else:
            instance_ids.add(instance_id)
        section_key = section.get('section_key')
        contract = get_section_contract(section_key)
        if contract is None:
            errors[f'{path}.section_key'] = 'Unknown section key.'
            continue
        section_counts[section_key] = section_counts.get(section_key, 0) + 1
        if section_counts[section_key] > 1 and not contract.allow_multiple:
            errors[f'{path}.section_key'] = 'This section may only appear once.'
        if not isinstance(section.get('enabled'), bool):
            errors[f'{path}.enabled'] = 'Must be boolean.'
        items = section.get('items')
        if not isinstance(items, list):
            errors[f'{path}.items'] = 'Must be a list.'
            continue
        if contract.requires_items and section.get('enabled', True) and not items:
            errors[f'{path}.items'] = 'An enabled section requires at least one item.'
        for item_index, item in enumerate(items):
            item_path = f'{path}.items[{item_index}]'
            if not isinstance(item, dict):
                errors[item_path] = 'Must be an object.'
                continue
            item_id = item.get('item_id')
            if not isinstance(item_id, str) or not item_id:
                errors[f'{item_path}.item_id'] = 'A stable item_id is required.'
            elif item_id in item_ids:
                errors[f'{item_path}.item_id'] = 'Duplicate item_id.'
            else:
                item_ids.add(item_id)
            _validate_item_dates(item, item_path, errors)
            _validate_rich_text(item.get('description'), item_path, errors)


def _validate_item_dates(item, path, errors):
    for key in ('start_date', 'end_date'):
        value = item.get(key)
        if value is not None and (not isinstance(value, str) or not YEAR_MONTH_RE.fullmatch(value)):
            errors[f'{path}.{key}'] = 'Must be YYYY-MM or null.'


def _validate_inline_text_styles(styles, errors):
    if not isinstance(styles, dict):
        errors['content_json.inline_text_styles'] = 'Must be an object.'
        return
    for style_id, marks in styles.items():
        if not isinstance(style_id, str) or not style_id or not isinstance(marks, dict):
            errors['content_json.inline_text_styles'] = 'Contains an invalid field style.'
            return
        if set(marks).difference(SAFE_RICH_TEXT_MARKS):
            errors['content_json.inline_text_styles'] = 'Contains an unsupported field style mark.'
            return
        if any(
            key in marks and not isinstance(marks[key], bool)
            for key in ('bold', 'italic', 'underline')
        ):
            errors['content_json.inline_text_styles'] = 'Boolean field style marks must be boolean.'
            return
        if 'font_family' in marks and marks['font_family'] not in ALLOWED_FONT_FAMILIES:
            errors['content_json.inline_text_styles'] = 'Contains an unsupported field style font.'
            return
        if 'font_size_pt' in marks and (
            not isinstance(marks['font_size_pt'], (int, float))
            or not 8 <= marks['font_size_pt'] <= 32
        ):
            errors['content_json.inline_text_styles'] = (
                'Field style font size must be between 8 and 32 pt.'
            )
            return
        if 'color' in marks and (
            not isinstance(marks['color'], str) or not HEX_COLOR_RE.fullmatch(marks['color'])
        ):
            errors['content_json.inline_text_styles'] = (
                'Field style color must be a six-digit hex color.'
            )
            return


def _validate_rich_text(description, path, errors):
    if description is None:
        return
    if not isinstance(description, dict) or description.get('format') not in {
        'rich_text_v1',
        'rich_text_v2',
    }:
        errors[f'{path}.description'] = 'Must use rich_text_v1 or rich_text_v2.'
        return
    blocks = description.get('content')
    if not isinstance(blocks, list):
        errors[f'{path}.description.content'] = 'Must be a list.'
        return
    for block in blocks:
        if not isinstance(block, dict) or block.get('type') not in SAFE_RICH_TEXT_TYPES:
            errors[f'{path}.description.content'] = 'Contains an unsafe rich-text block.'
            return
        text = block.get('text')
        if not isinstance(text, str) or '<' in text or '>' in text:
            errors[f'{path}.description.content'] = 'Rich text must be plain text blocks, not HTML.'
            return
        if description.get('format') == 'rich_text_v1':
            continue
        runs = block.get('runs')
        if (
            not isinstance(runs, list)
            or ''.join(run.get('text', '') for run in runs if isinstance(run, dict)) != text
        ):
            errors[f'{path}.description.content'] = (
                'rich_text_v2 text must equal the concatenated runs.'
            )
            return
        for run in runs:
            if not isinstance(run, dict) or not isinstance(run.get('text'), str):
                errors[f'{path}.description.content'] = 'rich_text_v2 runs must contain text.'
                return
            marks = run.get('marks', {})
            if not isinstance(marks, dict) or set(marks).difference(SAFE_RICH_TEXT_MARKS):
                errors[f'{path}.description.content'] = 'rich_text_v2 contains unsupported marks.'
                return
            if any(
                key in marks and not isinstance(marks[key], bool)
                for key in ('bold', 'italic', 'underline')
            ):
                errors[f'{path}.description.content'] = 'Boolean rich-text marks must be boolean.'
                return
            if 'font_family' in marks and marks['font_family'] not in ALLOWED_FONT_FAMILIES:
                errors[f'{path}.description.content'] = 'Unsupported rich-text font family.'
                return
            if 'font_size_pt' in marks and (
                not isinstance(marks['font_size_pt'], (int, float))
                or not 8 <= marks['font_size_pt'] <= 32
            ):
                errors[f'{path}.description.content'] = (
                    'Rich-text font size must be between 8 and 32 pt.'
                )
                return
            if 'color' in marks and (
                not isinstance(marks['color'], str) or not HEX_COLOR_RE.fullmatch(marks['color'])
            ):
                errors[f'{path}.description.content'] = (
                    'Rich-text color must be a six-digit hex color.'
                )
                return


def _validate_layout(layout, content, errors):
    if not isinstance(layout, dict):
        errors['layout_json'] = 'Must be an object.'
        return
    if layout.get('schema_version') != CANONICAL_SCHEMA_VERSION:
        errors['layout_json.schema_version'] = 'Must be 1.'
    page = layout.get('page')
    if (
        not isinstance(page, dict)
        or page.get('size') != 'A4'
        or not isinstance(page.get('margin_mm'), (int, float))
    ):
        errors['layout_json.page'] = 'Requires A4 page size and numeric margin_mm.'
    regions = layout.get('regions')
    if not isinstance(regions, list) or not regions:
        errors['layout_json.regions'] = 'Requires at least one region.'
        return
    valid_instance_ids = (
        {
            section.get('instance_id')
            for section in content.get('sections', [])
            if isinstance(section, dict)
        }
        if isinstance(content, dict)
        else set()
    )
    region_ids = set()
    assigned_sections = set()
    row_widths = {}
    for index, region in enumerate(regions):
        path = f'layout_json.regions[{index}]'
        if not isinstance(region, dict):
            errors[path] = 'Must be an object.'
            continue
        region_id = region.get('id')
        if not isinstance(region_id, str) or not region_id or region_id in region_ids:
            errors[f'{path}.id'] = 'Region id must be unique and non-empty.'
        else:
            region_ids.add(region_id)
        width = region.get('width_percent')
        if not isinstance(width, (int, float)) or not 0 < width <= 100:
            errors[f'{path}.width_percent'] = 'Must be between 0 and 100.'
        else:
            row = region.get('row', 0)
            if not isinstance(row, int) or row < 0:
                errors[f'{path}.row'] = 'Must be a non-negative integer.'
                row = 0
            row_widths[row] = row_widths.get(row, 0) + width
        section_ids = region.get('section_instance_ids')
        if not isinstance(section_ids, list):
            errors[f'{path}.section_instance_ids'] = 'Must be a list.'
            continue
        for section_id in section_ids:
            if section_id not in valid_instance_ids:
                errors[f'{path}.section_instance_ids'] = 'References an unknown section instance.'
            elif section_id in assigned_sections:
                errors[f'{path}.section_instance_ids'] = 'A section can only belong to one region.'
            assigned_sections.add(section_id)
    if any(abs(width - 100) > 0.01 for width in row_widths.values()):
        errors['layout_json.regions'] = 'Region widths must total 100 percent in each row.'
    hidden_ids = layout.get('hidden_section_instance_ids', [])
    if not isinstance(hidden_ids, list) or any(
        not isinstance(section_id, str) for section_id in hidden_ids
    ):
        errors['layout_json.hidden_section_instance_ids'] = 'Must be a list of section IDs.'
    elif len(hidden_ids) != len(set(hidden_ids)) or any(
        section_id not in valid_instance_ids for section_id in hidden_ids
    ):
        errors['layout_json.hidden_section_instance_ids'] = 'Must contain unique known section IDs.'
    elif assigned_sections.intersection(hidden_ids):
        errors['layout_json.hidden_section_instance_ids'] = (
            'A hidden section cannot also be assigned to a region.'
        )
    item_orders = layout.get('item_orders', {})
    if not isinstance(item_orders, dict):
        errors['layout_json.item_orders'] = 'Must be an object when present.'
        return
    items_by_section = (
        {
            section.get('instance_id'): {
                item.get('item_id') for item in section.get('items', []) if isinstance(item, dict)
            }
            for section in content.get('sections', [])
            if isinstance(section, dict)
        }
        if isinstance(content, dict)
        else {}
    )
    for section_id, item_ids in item_orders.items():
        path = f'layout_json.item_orders.{section_id}'
        if section_id not in valid_instance_ids:
            errors[path] = 'References an unknown section instance.'
            continue
        if not isinstance(item_ids, list) or any(
            not isinstance(item_id, str) for item_id in item_ids
        ):
            errors[path] = 'Must be a list of item IDs.'
            continue
        if len(item_ids) != len(set(item_ids)) or set(item_ids) != items_by_section.get(
            section_id, set()
        ):
            errors[path] = 'Must contain every item ID of its section exactly once.'


def _validate_style(style, errors):
    if not isinstance(style, dict):
        errors['style_json'] = 'Must be an object.'
        return
    if style.get('schema_version') != CANONICAL_SCHEMA_VERSION:
        errors['style_json.schema_version'] = 'Must be 1.'
    if not isinstance(style.get('theme_color'), str) or not HEX_COLOR_RE.fullmatch(
        style['theme_color']
    ):
        errors['style_json.theme_color'] = 'Must be a six-digit hex color.'
    if style.get('font_family') not in ALLOWED_FONT_FAMILIES:
        errors['style_json.font_family'] = 'Unsupported font family.'
    if (
        not isinstance(style.get('font_scale'), (int, float))
        or not 0.8 <= style['font_scale'] <= 1.4
    ):
        errors['style_json.font_scale'] = 'Must be between 0.8 and 1.4.'
    if (
        not isinstance(style.get('line_height'), (int, float))
        or not 1.0 <= style['line_height'] <= 2.0
    ):
        errors['style_json.line_height'] = 'Must be between 1.0 and 2.0.'
    if not isinstance(style.get('section_overrides'), dict):
        errors['style_json.section_overrides'] = 'Must be an object.'

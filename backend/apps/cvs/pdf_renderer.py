"""Server-side PDF projection for immutable canonical CV versions.

This module is deliberately independent from ``CvDraft`` and HTTP/DOM state.
It translates the same canonical content/layout/style documents consumed by the
owner view through the deployed renderer contract selected by the pinned
template version.
"""

from __future__ import annotations

import base64
from copy import deepcopy

from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.template.loader import render_to_string

from apps.cv_templates.renderers import validate_renderer_contract
from apps.cv_templates.section_registry import get_section_contract
from .models import CvAsset


class PdfRenderingError(RuntimeError):
    """A worker-safe rendering failure that never includes CV content."""


FONT_STACKS = {
    'Arial': 'Arial, Helvetica, sans-serif',
    'Calibri': 'Calibri, Carlito, Arial, sans-serif',
    'Inter': 'Inter, Arial, sans-serif',
    'Roboto': 'Roboto, Arial, sans-serif',
    'Source Sans Pro': 'Source Sans Pro, Arial, sans-serif',
}


def _rich_text_blocks(value) -> list[dict]:
    if not isinstance(value, dict):
        return []
    blocks = [
        {
            'type': block.get('type', 'paragraph'),
            'text': block['text'],
            'runs': block.get('runs') or [{'text': block['text'], 'marks': {}}],
        }
        for block in value.get('content', [])
        if isinstance(block, dict) and isinstance(block.get('text'), str) and block['text']
    ]
    return blocks


def _item_projection(item: dict) -> dict:
    """Project registered canonical item fields without template-specific mapping."""
    heading = next((item[key] for key in ('name', 'degree', 'title', 'role', 'value') if isinstance(item.get(key), str) and item[key]), '')
    metadata = [
        item[key]
        for key in ('company', 'institution', 'issuer', 'organization', 'start_date', 'end_date')
        if isinstance(item.get(key), str) and item[key]
    ]
    description = _rich_text_blocks(item.get('description'))
    if not description and isinstance(item.get('value'), str) and item.get('value') != heading:
        description = [{'type': 'paragraph', 'text': item['value'], 'runs': [{'text': item['value'], 'marks': {}}]}]
    return {'heading': heading, 'metadata': ' · '.join(metadata), 'description_blocks': description}


def _ordered_items(section: dict, item_orders: dict) -> list[dict]:
    items = [item for item in section.get('items', []) if isinstance(item, dict)]
    desired_order = item_orders.get(section.get('instance_id'), []) if isinstance(item_orders, dict) else []
    if not desired_order:
        return items
    by_id = {item.get('item_id'): item for item in items}
    return [by_id[item_id] for item_id in desired_order if item_id in by_id]


def _project_sections(version, contract) -> list[dict]:
    content = version.content_json
    layout = version.layout_json
    sections_by_id = {
        section.get('instance_id'): deepcopy(section)
        for section in content.get('sections', [])
        if isinstance(section, dict) and section.get('instance_id') and section.get('enabled') is True
    }
    configured_regions = {
        region.get('id'): region
        for region in layout.get('regions', [])
        if isinstance(region, dict) and region.get('id') in contract.allowed_regions
    }
    rendered_ids = set()
    hidden_ids = set(layout.get('hidden_section_instance_ids', []))
    regions = []
    for region_key in contract.region_order:
        region = configured_regions.get(region_key)
        if region is None:
            continue
        rendered_sections = []
        for section_id in region.get('section_instance_ids', []):
            section = sections_by_id.get(section_id)
            if section is None:
                continue
            rendered_ids.add(section_id)
            section_contract = get_section_contract(section.get('section_key'))
            rendered_sections.append({
                'section_key': section.get('section_key'),
                'personal_info_backed': bool(section_contract and section_contract.personal_info_backed),
                'title': section.get('title') or (section_contract.display_name if section_contract else section.get('section_key', '')),
                'items': [_item_projection(item) for item in _ordered_items(section, layout.get('item_orders', {}))],
            })
        regions.append({
            'id': region_key,
            'row': region.get('row', 0),
            'width_percent': region.get('width_percent', 100),
            'sections': rendered_sections,
        })
    if not regions:
        regions.append({'id': contract.region_order[0], 'row': 0, 'width_percent': 100, 'sections': []})
    unassigned_sections = [section for section_id, section in sections_by_id.items() if section_id not in rendered_ids and section_id not in hidden_ids]
    for section in unassigned_sections:
        section_contract = get_section_contract(section.get('section_key'))
        regions[0]['sections'].append({
            'section_key': section.get('section_key'),
            'personal_info_backed': bool(section_contract and section_contract.personal_info_backed),
            'title': section.get('title') or (section_contract.display_name if section_contract else section.get('section_key', '')),
            'items': [_item_projection(item) for item in _ordered_items(section, layout.get('item_orders', {}))],
        })
    return regions


def _asset_data_uri(public_id, kind):
    if not public_id:
        return ''
    try:
        asset = CvAsset.objects.get(public_id=public_id, kind=kind, is_active=True)
        with default_storage.open(asset.storage_key, 'rb') as stream:
            encoded = base64.b64encode(stream.read()).decode('ascii')
    except (CvAsset.DoesNotExist, OSError):
        return ''
    return f'data:{asset.content_type};base64,{encoded}'


def build_cv_pdf_html(version) -> str:
    """Build safe A4 HTML from exactly one immutable ``CvVersion`` row."""
    template_version = version.template_version
    if template_version is None:
        raise PdfRenderingError('The selected CV version has no pinned template renderer.')
    regions = [
        region.get('id')
        for region in version.layout_json.get('regions', [])
        if isinstance(region, dict)
    ]
    try:
        contract = validate_renderer_contract(
            template_version.renderer_key,
            version.schema_version,
            regions,
        )
    except ValidationError as error:
        raise PdfRenderingError('The selected CV version does not satisfy its renderer contract.') from error
    if template_version.renderer_version != contract.version:
        raise PdfRenderingError('The selected CV version has an unsupported renderer version.')
    content = version.content_json
    style = version.style_json
    personal_info = content.get('personal_info', {}) if isinstance(content, dict) else {}
    projected_regions = _project_sections(version, contract)
    rows = []
    for row_number in sorted({region['row'] for region in projected_regions}):
        rows.append({'number': row_number, 'regions': [region for region in projected_regions if region['row'] == row_number]})
    return render_to_string('cvs/pdf/cv_version.html', {
        'locale': content.get('locale', 'vi-VN'),
        'renderer_key': contract.key,
        'renderer_version': contract.version,
        'margin_mm': version.layout_json.get('page', {}).get('margin_mm', 12),
        'theme_color': style.get('theme_color', '#00A66A'),
        'font_stack': FONT_STACKS.get(style.get('font_family'), FONT_STACKS['Roboto']),
        'font_scale': style.get('font_scale', 1.0),
        'line_height': style.get('line_height', 1.4),
        'personal_info': personal_info,
        'rows': rows,
        'show_legacy_header': contract.key != 'header_two_column_v1',
        'avatar_data_uri': _asset_data_uri(personal_info.get('avatar_asset_id'), CvAsset.Kind.AVATAR),
        'background_data_uri': _asset_data_uri(style.get('background_asset_id'), CvAsset.Kind.BACKGROUND),
    })


def render_cv_version_pdf(version) -> bytes:
    """Render HTML/CSS to PDF only when the worker has the PDF engine installed."""
    html = build_cv_pdf_html(version)
    try:
        from weasyprint import HTML
    except ImportError as error:  # pragma: no cover - exercised in deployment configuration
        raise PdfRenderingError('The PDF rendering engine is unavailable.') from error
    pdf = HTML(string=html).write_pdf()
    if not pdf.startswith(b'%PDF'):
        raise PdfRenderingError('The PDF rendering engine returned an invalid artifact.')
    return pdf

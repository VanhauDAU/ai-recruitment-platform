"""Canonical CV document composition shared by preview and write workflows."""

from copy import deepcopy

from django.core.exceptions import ValidationError

from apps.cv_templates.models import CvTemplate, CvTemplateVersion
from apps.cv_templates.section_registry import SECTION_REGISTRY

from ..schemas import (
    empty_layout,
    empty_style,
    validate_cv_document,
    validate_template_layout_capabilities,
)

# Sections a renderer fills from `personal_info` and the editor refuses to
# delete, so a document is only complete once they exist. `avatar` is backed by
# personal info too but stays optional: a candidate opts into the photo.
MARKER_SECTION_KEYS = {
    contract.key: contract.display_name
    for contract in SECTION_REGISTRY.values()
    if contract.personal_info_backed and not contract.deletable
}


class CvCompositionError(ValidationError):
    """The selected template cannot compose a valid canonical document."""


def published_template_version(template):
    """Return the template's active immutable rendering contract."""
    version = template.current_published_version
    if (
        template.status != CvTemplate.Status.ACTIVE
        or template.lifecycle_status != CvTemplate.LifecycleStatus.PUBLISHED
        or version is None
        or version.template_id != template.pk
        or version.version_status != CvTemplateVersion.VersionStatus.PUBLISHED
    ):
        raise CvCompositionError('The selected template does not have a published version.')
    return version


def _unique_instance_id(content_json, section_key):
    known = {
        section.get('instance_id')
        for section in content_json.get('sections', [])
        if isinstance(section, dict)
    }
    number = 1
    while f'{section_key}_{number}' in known:
        number += 1
    return f'{section_key}_{number}'


def add_missing_marker_sections(template_version, content_json):
    """Give a template the personal-info markers its layout maps but content lacks.

    Most layouts draw the candidate's name and contact details from a header
    block the renderer owns.  A header layout instead maps the ``nameplate`` and
    ``contact`` sections into a region, so without those instances it would
    render a CV with no name at all.  Starter content is renderer-neutral by
    design and carries neither, so composition — the one place that knows both
    the content and the template — materializes them.  The markers hold no
    content of their own: every renderer reads them from ``personal_info``.
    """
    mapped_keys = {
        section.section_definition.section_key
        for section in template_version.sections.select_related('section_definition')
    }
    existing_keys = {
        section.get('section_key')
        for section in content_json.get('sections', [])
        if isinstance(section, dict)
    }
    missing = [
        section_key
        for section_key in MARKER_SECTION_KEYS
        if section_key in mapped_keys and section_key not in existing_keys
    ]
    if not missing:
        return content_json
    sections = content_json.setdefault('sections', [])
    for position, section_key in enumerate(missing):
        sections.insert(
            position,
            {
                'instance_id': _unique_instance_id(content_json, section_key),
                'section_key': section_key,
                'title': MARKER_SECTION_KEYS[section_key],
                'enabled': True,
                'items': [],
            },
        )
    return content_json


def layout_for_content(template_version, content_json):
    """Map canonical section instances into the regions owned by a template."""
    layout = deepcopy(template_version.default_layout_json or empty_layout())
    regions = layout.get('regions', [])
    if not regions:
        return layout

    for region in regions:
        if isinstance(region, dict):
            region['section_instance_ids'] = []
    layout.pop('item_orders', None)

    regions_by_id = {region.get('id'): region for region in regions if isinstance(region, dict)}
    region_for_section = {
        section.section_definition.section_key: section.region_key
        for section in template_version.sections.select_related('section_definition')
    }
    hidden_section_ids = []
    fallback_region = regions[0]
    for section in content_json.get('sections', []):
        if not isinstance(section, dict) or not section.get('instance_id'):
            continue
        configured_region = region_for_section.get(section.get('section_key'))
        if not region_for_section:
            configured_region = fallback_region.get('id')
        if configured_region is None:
            hidden_section_ids.append(section['instance_id'])
            continue
        region = regions_by_id.get(configured_region, fallback_region)
        assigned_ids = region.setdefault('section_instance_ids', [])
        if section['instance_id'] not in assigned_ids:
            assigned_ids.append(section['instance_id'])
    layout['hidden_section_instance_ids'] = hidden_section_ids
    return layout


def compose_cv_document(*, template, content_json, theme_color=None, template_version=None):
    """Build and validate one renderer-neutral canonical CV document."""
    version = template_version or published_template_version(template)
    content = add_missing_marker_sections(version, deepcopy(content_json))
    layout = layout_for_content(version, content)
    style = deepcopy(version.default_style_json or empty_style())
    if theme_color:
        style['theme_color'] = theme_color

    validate_cv_document(
        content_json=content,
        layout_json=layout,
        style_json=style,
        schema_version=version.schema_version,
    )
    validate_template_layout_capabilities(
        layout_json=layout,
        capabilities=version.capabilities,
    )
    return {
        'schema_version': version.schema_version,
        'content_json': content,
        'layout_json': layout,
        'style_json': style,
    }


def overlay_actor_identity(content_json, actor, *, fill_only=False, clear_demo_contacts=False):
    """Apply account-owned identity without mutating configured starter content."""
    content = deepcopy(content_json)
    personal_info = content.setdefault('personal_info', {})
    identity = {
        'full_name': getattr(actor, 'full_name', '') or '',
        'email': getattr(actor, 'email', '') or '',
        'phone': getattr(actor, 'phone', '') or '',
    }
    for field, value in identity.items():
        if value and (not fill_only or not personal_info.get(field)):
            personal_info[field] = value
    if clear_demo_contacts:
        personal_info['address'] = ''
        personal_info['links'] = []
    return content


def finalize_preview_document(document, *, actor=None, theme_color=None):
    """Apply request-specific, non-cacheable preview data to a base document."""
    result = deepcopy(document)
    if actor is not None and getattr(actor, 'is_authenticated', False):
        result['content_json'] = overlay_actor_identity(
            result['content_json'],
            actor,
            clear_demo_contacts=True,
        )
    if theme_color:
        result['style_json']['theme_color'] = theme_color
    validate_cv_document(
        content_json=result['content_json'],
        layout_json=result['layout_json'],
        style_json=result['style_json'],
        schema_version=result['schema_version'],
    )
    return result

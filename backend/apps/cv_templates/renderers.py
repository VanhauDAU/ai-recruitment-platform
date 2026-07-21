"""Renderer contract registry.

Only a deployed renderer key may be persisted in a template version.  This
keeps database configuration declarative: it never stores a React component,
arbitrary CSS, or executable code.
"""

from dataclasses import dataclass

from django.core.exceptions import ValidationError


@dataclass(frozen=True)
class RendererContract:
    key: str
    version: str
    supported_schema_versions: frozenset[int]
    allowed_regions: frozenset[str]
    region_order: tuple[str, ...]


RENDERER_REGISTRY = {
    contract.key: contract
    for contract in (
        RendererContract(
            key='classic_single_column_v1',
            version='1',
            supported_schema_versions=frozenset({1}),
            allowed_regions=frozenset({'main'}),
            region_order=('main',),
        ),
        RendererContract(
            key='classic_two_column_v1',
            version='1',
            supported_schema_versions=frozenset({1}),
            allowed_regions=frozenset({'main', 'sidebar'}),
            region_order=('main', 'sidebar'),
        ),
        RendererContract(
            key='header_two_column_v1',
            version='1',
            supported_schema_versions=frozenset({1}),
            allowed_regions=frozenset({'header', 'main', 'sidebar'}),
            region_order=('header', 'main', 'sidebar'),
        ),
    )
}


def get_renderer_contract(renderer_key):
    return RENDERER_REGISTRY.get(renderer_key)


def validate_renderer_contract(renderer_key, schema_version, regions=None):
    """Validate a renderer-independent document against a deployed renderer."""
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

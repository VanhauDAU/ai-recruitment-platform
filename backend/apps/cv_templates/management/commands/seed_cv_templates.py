"""Seed the CV Builder template catalogue: templates, versions and taxonomy.

``seed_cv_catalog`` seeds starter content (sample contents, blueprints, colors)
and can only decorate templates that already exist. This command owns the other
half — the templates themselves plus their immutable published version, section
mapping, localizations, category links and color links — so the public
catalogue and the CV editor have something to render.

Idempotent: every row is created with get_or_create and a template that already
has a published version is left untouched.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.cv_templates.models import (
    CvCategory,
    CvColor,
    CvSectionDefinition,
    CvTemplate,
    CvTemplateCategoryLink,
    CvTemplateColorLink,
    CvTemplateLocalization,
    CvTemplateSection,
    CvTemplateVersion,
)
from apps.cv_templates.section_registry import section_definition_seed_data
from apps.cv_templates.services import publish_template_version

from ._cv_template_catalog import (
    CATEGORIES,
    DEFAULT_ENABLED_SECTIONS,
    LOCALES,
    PALETTE,
    PERSONAL_INFO_SECTIONS,
    REQUIRED_SECTIONS,
    SECTION_PLANS,
    TEMPLATES,
    layout_capabilities,
    layout_regions,
)


def _default_style(spec):
    return {
        'schema_version': 1,
        'theme_color': spec['theme_color'],
        'font_family': spec['font_family'],
        'font_scale': spec['font_scale'],
        'line_height': spec['line_height'],
        'background_asset_id': None,
        'section_overrides': {},
    }


def _default_layout(spec, regions):
    return {
        'schema_version': 1,
        'page': {'size': 'A4', 'margin_mm': spec['margin_mm']},
        'regions': regions,
    }


class Command(BaseCommand):
    help = 'Seed CV templates, published versions, taxonomy and color links (idempotent).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--snapshots',
            action='store_true',
            help='Queue catalogue thumbnail rendering (needs a Celery worker with the PDF engine).',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        definitions = self._sync_section_definitions()
        colors = self._seed_colors()
        categories = self._seed_categories()

        created_templates = 0
        published_versions = 0
        for sort_order, spec in enumerate(TEMPLATES):
            template, created = self._seed_template(spec, sort_order)
            created_templates += int(created)
            published_versions += int(
                self._seed_published_version(template, spec, definitions) is not None
            )
            self._seed_localizations(template, spec)
            self._link_categories(template, spec, categories)
            self._link_colors(template, spec, colors)

        if options['snapshots']:
            from apps.cv_templates.tasks import regenerate_all_template_snapshots

            transaction.on_commit(regenerate_all_template_snapshots.delay)

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. {created_templates} template(s) and {published_versions} published '
                f'version(s) created; {CvTemplate.objects.count()} template(s) in the catalogue.'
            )
        )

    def _sync_section_definitions(self):
        """The template sections point at registry rows, so make sure they exist."""
        for entry in section_definition_seed_data():
            CvSectionDefinition.objects.get_or_create(
                section_key=entry['section_key'],
                defaults=entry,
            )
        return {
            definition.section_key: definition for definition in CvSectionDefinition.objects.all()
        }

    def _seed_colors(self):
        colors = {}
        for sort_order, (name, slug, hex_code) in enumerate(PALETTE):
            color, _ = CvColor.objects.get_or_create(
                hex_code=hex_code,
                defaults={
                    'name': name,
                    'slug': slug,
                    'sort_order': sort_order,
                    'is_active': True,
                },
            )
            colors[hex_code] = color
        return colors

    def _seed_categories(self):
        categories = {}
        for category_type, slug, name, description, sort_order in CATEGORIES:
            category, _ = CvCategory.objects.get_or_create(
                category_type=category_type,
                slug=slug,
                defaults={
                    'name': name,
                    'description': description,
                    'sort_order': sort_order,
                    'is_active': True,
                },
            )
            categories[slug] = category
        return categories

    def _seed_template(self, spec, sort_order):
        return CvTemplate.objects.get_or_create(
            slug=spec['slug'],
            defaults={
                'name': spec['names']['vi-VN'],
                'description': spec['descriptions']['vi-VN'],
                # The legacy comma-separated column stays empty on purpose:
                # `seed_cv_catalog` converts it into ad-hoc categories, and this
                # command already links the real taxonomy rows below.
                'category': '',
                'is_premium': spec['is_premium'],
                'sort_order': sort_order,
                'status': CvTemplate.Status.INACTIVE,
                'lifecycle_status': CvTemplate.LifecycleStatus.DRAFT,
            },
        )

    def _seed_published_version(self, template, spec, definitions):
        """Create version 1 as a draft, map its sections, then publish it."""
        if template.current_published_version_id or template.versions.exists():
            return None
        regions = layout_regions(spec['renderer_key'], spec.get('sidebar_percent', 35))
        version = CvTemplateVersion.objects.create(
            template=template,
            version_number=1,
            version_status=CvTemplateVersion.VersionStatus.DRAFT,
            renderer_key=spec['renderer_key'],
            renderer_version='1',
            schema_version=1,
            layout_schema={'schema_version': 1, 'regions': [region['id'] for region in regions]},
            style_schema={
                'schema_version': 1,
                'fields': [
                    'theme_color',
                    'font_family',
                    'font_scale',
                    'line_height',
                    'background_asset_id',
                    'section_overrides',
                ],
            },
            default_layout_json=_default_layout(spec, regions),
            default_style_json=_default_style(spec),
            capabilities=layout_capabilities(spec['renderer_key'], regions),
            content_contract={'schema': 'canonical_cv_content_v1', 'schema_version': 1},
        )
        for region_key, section_keys in SECTION_PLANS[spec['renderer_key']].items():
            for order, section_key in enumerate(section_keys):
                CvTemplateSection.objects.create(
                    template_version=version,
                    section_definition=definitions[section_key],
                    region_key=region_key,
                    default_order=order,
                    is_required=section_key in REQUIRED_SECTIONS,
                    is_default_enabled=section_key in DEFAULT_ENABLED_SECTIONS,
                    is_draggable=True,
                    use_theme_color=section_key not in PERSONAL_INFO_SECTIONS,
                )
        return publish_template_version(template=template, version=version)

    def _seed_localizations(self, template, spec):
        for locale in LOCALES:
            display_name = spec['names'][locale]
            description = spec['descriptions'][locale]
            CvTemplateLocalization.objects.get_or_create(
                template=template,
                locale=locale,
                defaults={
                    'display_name': display_name,
                    'description': description,
                    'seo_title': display_name,
                    'seo_description': description,
                    'is_active': True,
                },
            )

    def _link_categories(self, template, spec, categories):
        for sort_order, slug in enumerate(spec['categories']):
            CvTemplateCategoryLink.objects.get_or_create(
                template=template,
                category=categories[slug],
                defaults={'sort_order': sort_order},
            )

    def _link_colors(self, template, spec, colors):
        """The template's own theme leads; the rest of the palette follows."""
        theme_color = colors[spec['theme_color']]
        ordered = [
            theme_color,
            *(color for hex_code, color in colors.items() if hex_code != spec['theme_color']),
        ]
        has_default = template.color_links.filter(is_default=True).exists()
        for sort_order, color in enumerate(ordered):
            CvTemplateColorLink.objects.get_or_create(
                template=template,
                color=color,
                defaults={
                    'is_default': sort_order == 0 and not has_default,
                    'sort_order': sort_order,
                },
            )

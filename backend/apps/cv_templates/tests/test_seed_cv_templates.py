"""The seeded catalogue must be publishable, browsable and safe to re-run."""

from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.cvs.schemas import empty_content
from apps.cvs.services.composition import compose_cv_document

from ..management.commands._cv_template_catalog import (
    LOCALES,
    SECTION_PLANS,
    TEMPLATES,
    layout_capabilities,
    layout_regions,
)
from ..models import (
    CvCategory,
    CvTemplate,
    CvTemplateColorLink,
    CvTemplateLocalization,
    CvTemplateSection,
    CvTemplateVersion,
)
from ..renderers import validate_renderer_contract
from ..selectors import published_template_queryset


class SeedCvTemplatesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_cv_templates', stdout=StringIO())

    def test_every_template_is_published_with_an_immutable_version(self):
        self.assertEqual(CvTemplate.objects.count(), len(TEMPLATES))
        for template in CvTemplate.objects.all():
            with self.subTest(template=template.slug):
                self.assertEqual(template.status, CvTemplate.Status.ACTIVE)
                self.assertEqual(template.lifecycle_status, CvTemplate.LifecycleStatus.PUBLISHED)
                version = template.current_published_version
                self.assertIsNotNone(version)
                self.assertEqual(version.version_status, CvTemplateVersion.VersionStatus.PUBLISHED)

    def test_every_version_matches_a_deployed_renderer_contract(self):
        for version in CvTemplateVersion.objects.select_related('template'):
            with self.subTest(template=version.template.slug):
                regions = [region['id'] for region in version.default_layout_json['regions']]
                contract = validate_renderer_contract(
                    version.renderer_key, version.schema_version, regions
                )
                self.assertEqual(version.renderer_version, contract.version)
                # Sections may only reference the renderer's own regions.
                self.assertLessEqual(
                    set(version.sections.values_list('region_key', flat=True)),
                    contract.allowed_regions,
                )

    def test_catalogue_is_browsable_in_every_supported_locale(self):
        for locale in LOCALES:
            with self.subTest(locale=locale):
                self.assertEqual(published_template_queryset(locale=locale).count(), len(TEMPLATES))
        self.assertEqual(CvTemplateLocalization.objects.count(), len(TEMPLATES) * len(LOCALES))

    def test_each_template_exposes_taxonomy_and_exactly_one_default_color(self):
        self.assertTrue(CvCategory.objects.filter(category_type='feature').exists())
        for template in CvTemplate.objects.all():
            with self.subTest(template=template.slug):
                self.assertTrue(template.category_links.exists())
                self.assertEqual(template.color_links.filter(is_default=True).count(), 1)
                default_link = template.color_links.get(is_default=True)
                self.assertEqual(
                    default_link.color.hex_code,
                    template.current_published_version.default_style_json['theme_color'],
                )

    def test_every_template_composes_a_valid_document_from_blank_content(self):
        """Composition is the contract the editor, preview and PDF all share."""
        for template in CvTemplate.objects.all():
            with self.subTest(template=template.slug):
                document = compose_cv_document(
                    template=template, content_json=empty_content('vi-VN')
                )
                regions = document['layout_json']['regions']
                self.assertEqual(
                    [region['id'] for region in regions],
                    list(SECTION_PLANS[template.current_published_version.renderer_key]),
                )

    def test_a_header_layout_always_renders_the_candidate_identity(self):
        """Header renderers drop the built-in header, so markers must be mapped."""
        header_templates = CvTemplate.objects.filter(
            current_published_version__renderer_key='header_two_column_v1'
        )
        self.assertTrue(header_templates.exists())
        for template in header_templates:
            with self.subTest(template=template.slug):
                document = compose_cv_document(
                    template=template, content_json=empty_content('vi-VN')
                )
                header = next(
                    region
                    for region in document['layout_json']['regions']
                    if region['id'] == 'header'
                )
                assigned = {
                    section['section_key']
                    for section in document['content_json']['sections']
                    if section['instance_id'] in header['section_instance_ids']
                }
                self.assertEqual(assigned, {'nameplate', 'contact'})

    def test_rerunning_the_command_changes_nothing(self):
        counts = (
            CvTemplate.objects.count(),
            CvTemplateVersion.objects.count(),
            CvTemplateSection.objects.count(),
            CvTemplateLocalization.objects.count(),
            CvTemplateColorLink.objects.count(),
            CvCategory.objects.count(),
        )

        call_command('seed_cv_templates', stdout=StringIO())

        self.assertEqual(
            counts,
            (
                CvTemplate.objects.count(),
                CvTemplateVersion.objects.count(),
                CvTemplateSection.objects.count(),
                CvTemplateLocalization.objects.count(),
                CvTemplateColorLink.objects.count(),
                CvCategory.objects.count(),
            ),
        )


class CatalogGeometryTests(TestCase):
    def test_region_widths_total_one_hundred_percent_per_row(self):
        for spec in TEMPLATES:
            with self.subTest(template=spec['slug']):
                regions = layout_regions(spec['renderer_key'], spec.get('sidebar_percent', 35))
                widths = {}
                for region in regions:
                    widths[region['row']] = widths.get(region['row'], 0) + region['width_percent']
                self.assertEqual(set(widths.values()), {100})

    def test_resizable_columns_stay_inside_the_declared_limits(self):
        for spec in TEMPLATES:
            with self.subTest(template=spec['slug']):
                regions = layout_regions(spec['renderer_key'], spec.get('sidebar_percent', 35))
                resize = layout_capabilities(spec['renderer_key'], regions)['layout'][
                    'column_resize'
                ]
                if not resize['enabled']:
                    # A single-column template has no pair to redistribute width
                    # between; enabling resize would fail canonical validation.
                    self.assertEqual(len(regions), 1)
                    continue
                for region in regions:
                    if region['width_percent'] == 100:
                        continue
                    self.assertGreaterEqual(region['width_percent'], resize['min_percent'])
                    self.assertLessEqual(region['width_percent'], resize['max_percent'])

"""The seeded catalogue must be publishable, browsable and safe to re-run."""

from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.cvs.schemas import empty_content
from apps.cvs.services.composition import compose_cv_document

from ..management.commands._cv_template_catalog import (
    SECTION_PLANS,
    TEMPLATES,
    layout_capabilities,
    layout_regions,
)
from ..models import (
    CATALOG_LANGUAGES,
    CvCategory,
    CvTemplate,
    CvTemplateColorLink,
    CvTemplateSection,
    CvTemplateVersion,
)
from ..renderers import get_renderer_contract, validate_renderer_contract
from ..selectors import published_template_queryset


class SeedCvTemplatesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_cv_templates', stdout=StringIO())

    def test_every_template_is_published_with_an_immutable_version(self):
        self.assertEqual(CvTemplate.objects.count(), len(TEMPLATES))
        for template in CvTemplate.objects.all():
            with self.subTest(template=template.slug):
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

    def test_catalogue_is_browsable_in_every_supported_language(self):
        for language in CATALOG_LANGUAGES:
            with self.subTest(language=language.code):
                templates = published_template_queryset(locale=language.code)
                self.assertEqual(templates.count(), len(TEMPLATES))
                self.assertTrue(all(template.catalog_seo_title for template in templates))

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

    def test_every_layout_places_the_candidate_identity_in_a_region(self):
        """There is no hard-coded header any more: identity markers must be placed."""
        for template in CvTemplate.objects.select_related('current_published_version'):
            with self.subTest(template=template.slug):
                document = compose_cv_document(
                    template=template, content_json=empty_content('vi-VN')
                )
                placed = {
                    instance_id
                    for region in document['layout_json']['regions']
                    for instance_id in region['section_instance_ids']
                }
                keys = {
                    section['section_key']
                    for section in document['content_json']['sections']
                    if section['instance_id'] in placed
                }
                self.assertTrue({'nameplate', 'contact'} <= keys)
                contract = get_renderer_contract(template.current_published_version.renderer_key)
                self.assertEqual('avatar' in keys, contract.avatar)

    def test_rerunning_the_command_changes_nothing(self):
        counts = (
            CvTemplate.objects.count(),
            CvTemplateVersion.objects.count(),
            CvTemplateSection.objects.count(),
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
                CvTemplateColorLink.objects.count(),
                CvCategory.objects.count(),
            ),
        )


class CatalogGeometryTests(TestCase):
    def test_region_widths_total_one_hundred_percent_per_row(self):
        for spec in TEMPLATES:
            with self.subTest(template=spec['slug']):
                regions = layout_regions(spec['renderer_key'], spec.get('side_percent'))
                widths = {}
                for region in regions:
                    widths[region['row']] = widths.get(region['row'], 0) + region['width_percent']
                self.assertEqual(set(widths.values()), {100})

    def test_resizable_columns_stay_inside_the_declared_limits(self):
        for spec in TEMPLATES:
            with self.subTest(template=spec['slug']):
                regions = layout_regions(spec['renderer_key'], spec.get('side_percent'))
                resize = layout_capabilities(spec['renderer_key'])['layout']['column_resize']
                shared_rows = {
                    region['row']
                    for region in regions
                    if sum(other['row'] == region['row'] for other in regions) > 1
                }
                if not resize['enabled']:
                    # No row holds two regions, so there is no width to redistribute.
                    self.assertEqual(shared_rows, set())
                    continue
                for region in regions:
                    if region['row'] not in shared_rows:
                        continue
                    self.assertGreaterEqual(region['width_percent'], resize['min_percent'])
                    self.assertLessEqual(region['width_percent'], resize['max_percent'])

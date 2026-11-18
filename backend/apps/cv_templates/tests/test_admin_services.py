"""Service của cổng admin Mẫu CV tách khỏi view (CVT-4): tạo/sửa mẫu, thư viện,
xuất bản kèm ảnh catalogue, lỗi sinh AI, xem trước theo vị trí."""

from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.exceptions import ValidationError

from apps.accounts.tests.helpers import make_admin
from apps.cv_templates.domain.section_registry import section_definition_seed_data
from apps.cv_templates.models.content_schema import empty_content

from ..models import (
    CvCategory,
    CvColor,
    CvSampleContent,
    CvSectionDefinition,
    CvTemplate,
    CvTemplateColorLink,
    CvTemplateVersion,
)
from ..services import (
    SampleGenerationUnavailable,
    blank_position_content,
    compose_position_preview,
    create_template,
    delete_library_item,
    estimate_generation_cost,
    publish_checked_template_version,
    publish_sample,
    update_template,
)
from .factories import make_published_template

LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


class TemplateAdminServiceTests(TestCase):
    def setUp(self):
        for entry in section_definition_seed_data():
            CvSectionDefinition.objects.update_or_create(
                section_key=entry['section_key'], defaults=entry
            )
        self.admin = make_admin('cv-services@example.com')
        self.style = CvCategory.objects.create(category_type='style', name='Gọn', slug='gon')
        self.audience = CvCategory.objects.create(
            category_type='audience', name='Sinh viên', slug='sinh-vien'
        )
        self.green = CvColor.objects.create(name='Xanh', slug='xanh', hex_code='#00A66A')

    def test_create_template_links_categories_and_starts_a_draft(self):
        template = create_template(
            name='Mới',
            categories=[self.style],
            renderer_key='single_column_v1',
            actor=self.admin,
        )

        self.assertEqual(list(template.categories.all()), [self.style])
        draft = template.versions.get()
        self.assertEqual(draft.version_status, CvTemplateVersion.VersionStatus.DRAFT)
        self.assertEqual(draft.created_by, self.admin)
        self.assertTrue(template.color_links.filter(color=self.green, is_default=True).exists())

    def test_create_template_without_layout_has_no_version(self):
        template = create_template(name='Chưa có bố cục')
        self.assertFalse(template.versions.exists())
        self.assertFalse(template.category_links.exists())

    def test_update_template_replaces_categories_only_when_given(self):
        template = create_template(name='Sửa', categories=[self.style])

        update_template(template, name='Đã sửa')
        self.assertEqual(list(template.categories.all()), [self.style])
        update_template(template, categories=[self.audience])

        template.refresh_from_db()
        self.assertEqual(template.name, 'Đã sửa')
        self.assertEqual(list(template.categories.all()), [self.audience])

    def test_library_item_in_use_is_kept(self):
        template, _ = make_published_template()
        CvTemplateColorLink.objects.create(template=template, color=self.green, is_default=True)
        unused = CvColor.objects.create(name='Lam', slug='lam', hex_code='#2255AA')

        with self.assertRaises(ValidationError) as blocked:
            delete_library_item(self.green)
        delete_library_item(unused)

        self.assertEqual(
            blocked.exception.detail, {'detail': 'Đang được 1 mẫu CV dùng, không xóa được.'}
        )
        self.assertTrue(CvColor.objects.filter(pk=self.green.pk).exists())
        self.assertFalse(CvColor.objects.filter(pk=unused.pk).exists())

    def test_checked_publish_refuses_a_failing_checklist(self):
        template = create_template(name='Chưa đạt', renderer_key='single_column_v1')

        with self.assertRaises(ValidationError) as error:
            publish_checked_template_version(template=template, version=template.versions.get())

        self.assertIn('test_pdf', error.exception.detail['checklist'])
        self.assertIsNone(CvTemplate.objects.get(pk=template.pk).current_published_version_id)

    def test_checked_publish_queues_one_snapshot_per_colour_after_commit(self):
        template = create_template(name='Đạt', renderer_key='single_column_v1')
        draft = template.versions.get()

        with (
            patch('apps.cv_templates.services.publishing.publish_checklist', return_value=[]),
            patch(
                'apps.cv_templates.tasks.template_assets.generate_template_color_snapshot.delay'
            ) as snapshot,
            self.captureOnCommitCallbacks(execute=True),
        ):
            version = publish_checked_template_version(
                template=template, version=draft, actor=self.admin
            )

        self.assertEqual(version.version_status, CvTemplateVersion.VersionStatus.PUBLISHED)
        self.assertEqual(snapshot.call_count, template.color_links.count())

    def test_publishing_a_sample_regenerates_catalogue_snapshots_after_commit(self):
        sample = CvSampleContent.objects.create(
            locale='vi-VN',
            experience_band='junior',
            title='Chung',
            content_json=empty_content('vi-VN'),
        )

        with (
            patch(
                'apps.cv_templates.tasks.template_assets.regenerate_all_template_snapshots.delay'
            ) as regenerate,
            self.captureOnCommitCallbacks(execute=False) as callbacks,
        ):
            publish_sample(sample, actor=self.admin)
            regenerate.assert_not_called()
        for callback in callbacks:
            callback()

        regenerate.assert_called_once_with()
        sample.refresh_from_db()
        self.assertEqual(sample.status, CvSampleContent.Status.PUBLISHED)

    def test_template_offers_only_its_active_colours(self):
        template, _ = make_published_template()
        CvTemplateColorLink.objects.create(template=template, color=self.green, is_default=True)

        self.assertTrue(template.offers_color('#00a66a'))
        self.assertFalse(template.offers_color('#2255AA'))
        self.green.is_active = False
        self.green.save(update_fields=['is_active'])
        self.assertFalse(template.offers_color('#00A66A'))


class SampleGenerationErrorTests(TestCase):
    def test_codes_map_to_http_status_and_safe_payload(self):
        cases = {
            'runtime_disabled': 503,
            'provider_not_configured': 503,
            'generation_in_progress': 409,
            'batch_too_large': 400,
        }
        for code, status_code in cases.items():
            error = SampleGenerationUnavailable(code)
            self.assertEqual((error.status_code, error.payload()), (status_code, {'code': code}))

    def test_estimate_clamps_the_count_and_scales_the_average(self):
        with patch(
            'apps.cv_templates.services.sample_generation.average_generation_cost',
            return_value=0.01,
        ):
            self.assertEqual(
                estimate_generation_cost(100),
                {'count': 16, 'average_cost_usd': 0.01, 'estimated_cost_usd': 0.16},
            )
            self.assertEqual(estimate_generation_cost(0)['count'], 1)
        with patch(
            'apps.cv_templates.services.sample_generation.average_generation_cost',
            return_value=None,
        ):
            self.assertIsNone(estimate_generation_cost(3)['estimated_cost_usd'])


@override_settings(CACHES=LOCMEM)
class PositionPreviewServiceTests(TestCase):
    def test_base_document_is_cached_and_revision_is_stable(self):
        template, _ = make_published_template()
        resolved = blank_position_content(locale='vi-VN', experience_band='junior')
        options = {
            'template': template,
            'resolved': resolved,
            'locale': 'vi-VN',
            'experience_band': 'junior',
            'theme_color': '',
            'actor': None,
            'demo_identity': False,
        }
        document = {'content_json': resolved['content_json']}

        with (
            patch(
                'apps.cv_templates.services.position_preview.compose_cv_document',
                return_value=document,
            ) as compose,
            patch(
                'apps.cv_templates.services.position_preview.finalize_preview_document',
                side_effect=lambda preview, **_: preview,
            ),
        ):
            first, first_hit = compose_position_preview(**options)
            second, second_hit = compose_position_preview(**options)

        self.assertEqual(compose.call_count, 1)
        self.assertEqual((first_hit, second_hit), (False, True))
        self.assertEqual(first['revision'], second['revision'])
        self.assertEqual(first['source'], 'blank')
        self.assertEqual(first['renderer']['key'], 'single_column_v1')

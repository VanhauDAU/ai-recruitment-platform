"""API cổng quản trị Mẫu CV (CVT-4): wizard template, thư viện, tổng quan."""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.tests.helpers import make_admin
from apps.cv_templates.domain.section_registry import section_definition_seed_data

from ..models import CvCategory, CvColor, CvSectionDefinition, CvTemplate, CvTemplateVersion
from ..services.template_preview import finish_test_pdf

LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
SECTIONS = [
    {'section_key': 'nameplate', 'region_key': 'main'},
    {'section_key': 'contact', 'region_key': 'main'},
    {'section_key': 'summary', 'region_key': 'main'},
    {'section_key': 'experience', 'region_key': 'main'},
    {'section_key': 'education', 'region_key': 'main'},
    {'section_key': 'skills', 'region_key': 'main'},
]


@override_settings(CACHES=LOCMEM)
class TemplateWizardApiTests(TestCase):
    def setUp(self):
        for entry in section_definition_seed_data():
            CvSectionDefinition.objects.update_or_create(
                section_key=entry['section_key'], defaults=entry
            )
        self.admin = make_admin('cv-wizard@example.com')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.style = CvCategory.objects.create(
            category_type='style', name='Hiện đại', slug='hien-dai'
        )
        self.green = CvColor.objects.create(name='Xanh', slug='xanh', hex_code='#00A66A')
        self.blue = CvColor.objects.create(name='Lam', slug='lam', hex_code='#2255AA')

    def create_draft(self):
        template = self.client.post(
            '/api/v2/admin/cv-templates/',
            {
                'name': 'Gọn gàng',
                'display_name_vi': 'Gọn gàng',
                'display_name_en': 'Tidy',
                'category_public_ids': [self.style.public_id],
            },
            format='json',
        )
        self.assertEqual(template.status_code, 201, template.data)
        public_id = template.data['public_id']
        version = self.client.post(
            f'/api/v2/admin/cv-templates/{public_id}/versions/',
            {'renderer_key': 'single_column_v1'},
            format='json',
        )
        self.assertEqual(version.status_code, 201, version.data)
        return public_id, version.data['id']

    def configure(self, public_id, version_id, **payload):
        return self.client.patch(
            f'/api/v2/admin/cv-templates/{public_id}/versions/{version_id}/config/',
            payload,
            format='json',
        )

    def test_wizard_builds_a_publishable_template_without_raw_json(self):
        public_id, version_id = self.create_draft()

        layout = self.configure(
            public_id,
            version_id,
            renderer_key='sidebar_right_v1',
            widths={'main': 60, 'sidebar': 40},
            style={'font_family': 'Lora', 'font_scale': 1.0, 'line_height': 1.5},
            sections=[
                *SECTIONS[:2],
                *SECTIONS[2:5],
                {'section_key': 'skills', 'region_key': 'sidebar'},
            ],
        )
        colors = self.client.put(
            f'/api/v2/admin/cv-templates/{public_id}/colors/',
            {
                'color_public_ids': [self.blue.public_id, self.green.public_id],
                'default_color_public_id': self.green.public_id,
            },
            format='json',
        )
        preview = self.client.post(
            f'/api/v2/admin/cv-templates/{public_id}/preview/',
            {'version_id': version_id, 'locale': 'en-US', 'theme_color': '#2255AA'},
            format='json',
        )

        self.assertEqual(layout.status_code, 200, layout.data)
        self.assertEqual(
            [region['width_percent'] for region in layout.data['default_layout_json']['regions']],
            [60, 40],
        )
        self.assertEqual(
            layout.data['sections'][-1],
            {
                'section_key': 'skills',
                'region_key': 'sidebar',
                'is_required': False,
                'is_default_enabled': True,
            },
        )
        self.assertEqual(colors.status_code, 200, colors.data)
        self.assertEqual([color['is_default'] for color in colors.data['colors']], [False, True])
        self.assertEqual(colors.data['category_public_ids'], [self.style.public_id])
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data['renderer_key'], 'sidebar_right_v1')
        self.assertEqual(
            preview.data['document']['content_json']['personal_info']['full_name'], 'Alex Nguyen'
        )

        checklist = self.client.get(
            f'/api/v2/admin/cv-templates/{public_id}/versions/{version_id}/checklist/'
        )
        blocked = self.client.post(
            f'/api/v2/admin/cv-templates/{public_id}/versions/{version_id}/publish/'
        )
        self.assertEqual(
            [item['key'] for item in checklist.data['items'] if not item['ok']], ['test_pdf']
        )
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(blocked.data['checklist'], ['test_pdf'])

        finish_test_pdf('a' * 32, CvTemplateVersion.objects.get(pk=version_id), b'%PDF-test')
        with patch('apps.cv_templates.services.publishing.enqueue_template_snapshots'):
            published = self.client.post(
                f'/api/v2/admin/cv-templates/{public_id}/versions/{version_id}/publish/'
            )
        self.assertEqual(published.status_code, 200, published.data)
        self.assertEqual(published.data['published_by_name'], self.admin.email)
        self.assertEqual(CvTemplate.objects.get(public_id=public_id).lifecycle_status, 'published')

    def test_a_new_template_starts_with_a_ready_draft(self):
        """Tạo mẫu kèm bố cục: có ngay bản nháp đủ section và bảng màu khởi đầu."""
        response = self.client.post(
            '/api/v2/admin/cv-templates/',
            {
                'name': 'Nhanh',
                'display_name_vi': 'Nhanh',
                'display_name_en': 'Quick',
                'renderer_key': 'sidebar_left_photo_v1',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        (draft,) = response.data['versions']
        placed = {section['section_key']: section['region_key'] for section in draft['sections']}
        self.assertEqual(draft['version_status'], 'draft')
        self.assertEqual(placed['avatar'], 'sidebar')
        self.assertEqual(placed['experience'], 'main')
        self.assertEqual([color['is_default'] for color in response.data['colors']], [True, False])
        # Màu đầu thư viện (theo thứ tự rồi tên) là màu mặc định.
        self.assertEqual(draft['default_style_json']['theme_color'], self.blue.hex_code)
        checklist = self.client.get(
            f'/api/v2/admin/cv-templates/{response.data["public_id"]}/versions/{draft["id"]}/checklist/'
        )
        self.assertEqual(
            [item['key'] for item in checklist.data['items'] if not item['ok']], ['test_pdf']
        )
        again = self.client.post(
            f'/api/v2/admin/cv-templates/{response.data["public_id"]}/versions/', format='json'
        )
        self.assertEqual(again.data['id'], draft['id'])

    def test_changing_layout_replaces_sections_and_accepts_full_width_rows(self):
        public_id, version_id = self.create_draft()
        self.configure(public_id, version_id, sections=SECTIONS)

        changed = self.configure(
            public_id,
            version_id,
            renderer_key='header_band_two_column_v1',
            widths={'header': 100, 'main': 60, 'sidebar': 40},
        )

        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(
            [region['width_percent'] for region in changed.data['default_layout_json']['regions']],
            [100, 60, 40],
        )
        placed = {
            section['section_key']: section['region_key'] for section in changed.data['sections']
        }
        self.assertEqual(
            placed,
            {
                'avatar': 'header',
                'nameplate': 'header',
                'contact': 'header',
                'summary': 'main',
                'experience': 'main',
                'education': 'main',
                'skills': 'sidebar',
            },
        )

    def test_editing_a_draft_invalidates_its_test_pdf(self):
        public_id, version_id = self.create_draft()
        self.configure(public_id, version_id, sections=SECTIONS)
        finish_test_pdf('b' * 32, CvTemplateVersion.objects.get(pk=version_id), b'%PDF-test')
        self.configure(public_id, version_id, style={'font_family': 'Lora'})

        checklist = self.client.get(
            f'/api/v2/admin/cv-templates/{public_id}/versions/{version_id}/checklist/'
        )
        self.assertFalse(
            next(item for item in checklist.data['items'] if item['key'] == 'test_pdf')['ok']
        )

    def test_invalid_configurations_are_rejected(self):
        public_id, version_id = self.create_draft()
        cases = [
            {'renderer_key': 'sidebar_right_v1', 'widths': {'main': 70, 'sidebar': 40}},
            {'renderer_key': 'sidebar_right_v1', 'widths': {'main': 90, 'sidebar': 10}},
            {'sections': [{'section_key': 'summary', 'region_key': 'main'}]},
            {'sections': [*SECTIONS, {'section_key': 'awards', 'region_key': 'sidebar'}]},
            {'style': {'font_family': 'Comic Sans'}},
            {'renderer_key': 'unknown_v9'},
        ]
        for payload in cases:
            with self.subTest(payload=payload):
                self.assertEqual(self.configure(public_id, version_id, **payload).status_code, 400)

    def test_test_pdf_is_rendered_by_the_worker_and_downloadable(self):
        public_id, version_id = self.create_draft()
        self.configure(public_id, version_id, sections=SECTIONS)

        with (
            patch(
                'apps.cv_templates.tasks.template_assets.render_template_test_pdf.delay'
            ) as delay,
            self.captureOnCommitCallbacks(execute=True),
        ):
            queued = self.client.post(
                f'/api/v2/admin/cv-templates/{public_id}/versions/{version_id}/test-pdf/',
                {'locale': 'vi-VN'},
                format='json',
            )
        token = queued.data['token']
        self.assertEqual(
            self.client.get(f'/api/v2/admin/cv-templates/test-pdf/{token}/').data,
            {'status': 'pending'},
        )

        from apps.cv_templates.tasks.template_assets import render_template_test_pdf

        with patch(
            'apps.cv_templates.tasks.template_assets.render_document_pdf',
            return_value=b'%PDF-1.7 ok',
        ):
            render_template_test_pdf(*delay.call_args.args)
        download = self.client.get(f'/api/v2/admin/cv-templates/test-pdf/{token}/', {'download': 1})

        self.assertEqual(download['Content-Type'], 'application/pdf')
        self.assertEqual(download.content, b'%PDF-1.7 ok')

    def test_duplicate_reorder_and_visibility(self):
        public_id, version_id = self.create_draft()
        self.configure(public_id, version_id, sections=SECTIONS)

        copy = self.client.post(f'/api/v2/admin/cv-templates/{public_id}/duplicate/')
        reorder = self.client.post(
            '/api/v2/admin/cv-templates/reorder/',
            {'public_ids': [copy.data['public_id'], public_id]},
            format='json',
        )
        show_unpublished = self.client.post(
            f'/api/v2/admin/cv-templates/{public_id}/lifecycle/',
            {'status': 'published'},
            format='json',
        )

        self.assertEqual(copy.status_code, 201, copy.data)
        self.assertEqual(copy.data['lifecycle_status'], 'draft')
        self.assertEqual(copy.data['category_public_ids'], [self.style.public_id])
        self.assertEqual(len(copy.data['versions'][0]['sections']), len(SECTIONS))
        self.assertEqual(reorder.status_code, 204)
        self.assertEqual(CvTemplate.objects.get(public_id=copy.data['public_id']).sort_order, 0)
        self.assertEqual(show_unpublished.status_code, 400)


@override_settings(CACHES=LOCMEM)
class LibraryAndPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_library_items_in_use_cannot_be_deleted(self):
        self.client.force_authenticate(make_admin('cv-library@example.com'))
        used = CvColor.objects.create(name='Xanh', slug='xanh', hex_code='#00A66A')
        unused = CvColor.objects.create(name='Đỏ', slug='do', hex_code='#AA2233')
        template = CvTemplate.objects.create(name='Mẫu')
        template.color_links.create(color=used, is_default=True)

        blocked = self.client.delete(f'/api/v2/admin/cv-colors/{used.public_id}/')
        deleted = self.client.delete(f'/api/v2/admin/cv-colors/{unused.public_id}/')

        self.assertEqual(blocked.status_code, 400)
        self.assertIn('1 mẫu CV', str(blocked.data))
        self.assertEqual(deleted.status_code, 204)

    def test_regular_admin_reaches_overview_and_generation_but_non_admin_is_rejected(self):
        self.client.force_authenticate(make_admin('cv-overview@example.com'))

        overview = self.client.get('/api/v2/admin/cv-stats/overview/')
        estimate = self.client.get('/api/v2/admin/cv-sample-generations/estimate/', {'count': 4})

        self.assertEqual(overview.status_code, 200)
        self.assertIn('samples_in_review', overview.data['todos'])
        self.assertEqual(estimate.status_code, 200)
        self.assertEqual(estimate.data['count'], 4)
        self.assertIsNone(estimate.data['estimated_cost_usd'])

        self.client.force_authenticate(
            get_user_model().objects.create_user(email='cv-candidate@example.com', password='x')
        )
        self.assertEqual(self.client.get('/api/v2/admin/cv-stats/overview/').status_code, 403)

from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import AdminPermission, AdminRole, Department, User
from apps.accounts.services import assign_membership
from apps.cvs.schemas import empty_content, empty_layout, empty_style
from apps.jobs.models import JobCategory, JobCategoryLocalization

from ..demo_identity import DEMO_IDENTITY
from ..management.commands.seed_cv_catalog import build_sample_content
from ..models import (
    CvCategory,
    CvColor,
    CvPositionProfile,
    CvSampleContent,
    CvSectionDefinition,
    CvTemplate,
    CvTemplateCategoryLink,
    CvTemplateColorLink,
    CvTemplateSection,
    CvTemplateVersion,
    localized_field,
)


class TemplateCatalogV2Tests(TestCase):
    def create_template(self, name, *, locale='vi-VN', categories=(), usage_count=0):
        template = CvTemplate.objects.create(
            name=name,
            **{
                localized_field('display_name', locale): f'{name} {locale}',
                localized_field('description', locale): f'{name} description',
            },
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
            usage_count=usage_count,
        )
        version = CvTemplateVersion.objects.create(
            template=template,
            version_number=1,
            version_status=CvTemplateVersion.VersionStatus.PUBLISHED,
            renderer_key='single_column_v1',
            renderer_version='1',
            default_layout_json=empty_layout(),
            default_style_json=empty_style(),
            capabilities={'supports_font_scale': True},
        )
        template.current_published_version = version
        template.save(update_fields=['current_published_version'])
        for category in categories:
            CvTemplateCategoryLink.objects.create(template=template, category=category)
        green, _ = CvColor.objects.get_or_create(
            hex_code='#00A66A',
            defaults={'name': 'Xanh', 'slug': 'green'},
        )
        blue, _ = CvColor.objects.get_or_create(
            hex_code='#2255AA',
            defaults={'name': 'Xanh dương', 'slug': 'blue'},
        )
        CvTemplateColorLink.objects.create(
            template=template,
            color=green,
            preview_url=f'/templates/{name}-green.png',
            is_default=True,
        )
        CvTemplateColorLink.objects.create(
            template=template,
            color=blue,
            preview_url=f'/templates/{name}-blue.png',
            sort_order=1,
        )
        return template

    def setUp(self):
        self.style = CvCategory.objects.create(
            category_type='style', name='Tối giản', slug='minimal'
        )
        self.audience = CvCategory.objects.create(
            category_type='audience', name='Chuyên nghiệp', slug='professional'
        )
        self.tag = CvCategory.objects.create(
            category_type='feature', name='Thân thiện ATS', slug='ats'
        )
        self.primary = self.create_template(
            'Primary',
            categories=(self.style, self.audience, self.tag),
            usage_count=10,
        )
        self.related = self.create_template('Related', categories=(self.audience,), usage_count=5)
        self.english = self.create_template('English', locale='en-US')
        self.sample_category = JobCategory.objects.create(
            name='AI/Machine Learning Engineer', slug='ai-machine-learning-engineer'
        )
        JobCategoryLocalization.objects.create(
            category=self.sample_category,
            locale='vi-VN',
            display_name='Kỹ sư AI/Machine Learning',
        )
        self.sample_profile = CvPositionProfile.objects.create(job_category=self.sample_category)
        self.sample = CvSampleContent.objects.create(
            position_profile=self.sample_profile,
            locale='vi-VN',
            experience_band='mid',
            title='Mẫu Front-end Developer',
            content_json=empty_content('vi-VN'),
            status=CvSampleContent.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        self.client = APIClient()

    def test_list_returns_card_contract_and_filters_locale_category_and_tag(self):
        response = self.client.get(
            '/api/v2/cv-templates/',
            {
                'locale': 'vi-VN',
                'category': 'professional',
                'tag': 'ats',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        card = response.data['results'][0]
        self.assertEqual(card['slug'], self.primary.slug)
        self.assertEqual(card['thumbnail_url'], '/templates/Primary-green.png')
        self.assertEqual(
            [(color['slug'], color['preview_url']) for color in card['colors']],
            [('green', '/templates/Primary-green.png'), ('blue', '/templates/Primary-blue.png')],
        )
        self.assertNotIn('theme_color', card)
        self.assertNotIn('color_variants', card)
        self.assertCountEqual(
            [category['slug'] for category in card['categories']],
            ['minimal', 'professional'],
        )
        self.assertEqual([tag['slug'] for tag in card['tags']], ['ats'])
        self.assertNotIn('default_layout_json', card)
        self.assertNotIn('renderer', card)
        self.assertEqual(response['Cache-Control'], 'public, no-cache')
        self.assertIn('ETag', response)

    def test_hiding_a_template_takes_effect_for_a_cached_catalogue_immediately(self):
        """Hồi quy: "Tất cả" trước đây còn hiện mẫu đã ẩn suốt 5 phút cache."""
        params = {'locale': 'vi-VN'}
        first = self.client.get('/api/v2/cv-templates/', params)
        unchanged = self.client.get(
            '/api/v2/cv-templates/', params, HTTP_IF_NONE_MATCH=first['ETag']
        )
        self.primary.lifecycle_status = CvTemplate.LifecycleStatus.ARCHIVED
        self.primary.save(update_fields=['lifecycle_status'])
        after_hide = self.client.get(
            '/api/v2/cv-templates/', params, HTTP_IF_NONE_MATCH=first['ETag']
        )

        self.assertEqual(unchanged.status_code, 304)
        self.assertEqual(after_hide.status_code, 200)
        self.assertNotIn(self.primary.slug, [card['slug'] for card in after_hide.data['results']])
        self.assertIn(self.primary.slug, [card['slug'] for card in first.data['results']])

    def test_detail_and_related_only_use_current_published_template_versions(self):
        detail = self.client.get(f'/api/v2/cv-templates/{self.primary.slug}/', {'locale': 'vi-VN'})
        related = self.client.get(
            f'/api/v2/cv-templates/{self.primary.slug}/related/', {'locale': 'vi-VN'}
        )

        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data['renderer']['key'], 'single_column_v1')
        self.assertNotIn('default_style_json', detail.data)
        self.assertEqual(related.status_code, 200)
        self.assertEqual([item['slug'] for item in related.data], [self.related.slug])
        self.assertEqual(
            self.client.get(
                f'/api/v2/cv-templates/{self.english.slug}/', {'locale': 'vi-VN'}
            ).status_code,
            404,
        )

    def test_category_and_sample_catalogues_are_compact_and_public(self):
        self.sample.content_json = {
            **self.sample.content_json,
            'personal_info': {'headline': 'Kỹ sư AI/Machine Learning'},
        }
        self.sample.save(update_fields=['content_json', 'updated_at'])
        categories = self.client.get('/api/v2/cv-categories/', {'type': 'feature'})
        samples = self.client.get('/api/v2/cv-sample-contents/', {'locale': 'vi-VN'})

        self.assertEqual(categories.status_code, 200)
        self.assertEqual([item['slug'] for item in categories.data], ['ats'])
        self.assertEqual(samples.status_code, 200)
        self.assertEqual(samples.data[0]['public_id'], self.sample.public_id)
        self.assertEqual(samples.data[0]['position_slug'], 'ai-machine-learning-engineer')
        self.assertEqual(samples.data[0]['position_name'], 'AI/Machine Learning Engineer')
        self.assertEqual(samples.data[0]['experience_band'], 'mid')
        self.assertTrue(all(item['position_public_id'] for item in samples.data))
        self.assertNotIn('content_json', samples.data[0])

    def test_seed_localizes_position_content_for_english_preview(self):
        content = build_sample_content('en-US', 'Customer Service Representative')

        self.assertEqual(content['personal_info']['headline'], 'Customer Service Representative')
        self.assertEqual(
            content['sections'][1]['items'][0]['role'], 'Customer Service Representative'
        )
        self.assertIn('3 years', content['sections'][0]['items'][0]['value'])
        self.assertNotIn('{position}', str(content))

    def test_position_picker_uses_specialization_taxonomy_and_selected_locale(self):
        JobCategory.objects.create(
            name='Nhóm không phải vị trí',
            category_type=JobCategory.CategoryType.OCCUPATION_GROUP,
        )

        response = self.client.get('/api/v2/cv-position-options/', {'q': 'Ky su'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            [
                {
                    'public_id': self.sample_category.public_id,
                    'slug': self.sample_category.slug,
                    'display_name': 'Kỹ sư AI/Machine Learning',
                    'name_vi': 'Kỹ sư AI/Machine Learning',
                }
            ],
        )

    def test_position_preview_can_return_a_composed_template_document(self):
        response = self.client.get(
            '/api/v2/cv-position-preview/',
            {
                'position_public_id': self.sample_category.public_id,
                'locale': 'vi-VN',
                'template_public_id': self.primary.public_id,
                'theme_color': '#2255AA',
            },
        )

        self.assertEqual(response.status_code, 200, response.data)
        content = response.data['document']['content_json']
        self.assertEqual(content['sections'], self.sample.content_json['sections'])
        # Khách thấy danh tính minh họa như ảnh catalogue; mẫu trong DB không đổi.
        self.assertEqual(content['personal_info']['full_name'], DEMO_IDENTITY['vi-VN']['full_name'])
        self.sample.refresh_from_db()
        self.assertFalse(self.sample.content_json['personal_info'].get('full_name'))
        self.assertEqual(response.data['document']['style_json']['theme_color'], '#2255AA')
        self.assertEqual(response.data['renderer']['key'], 'single_column_v1')
        self.assertTrue(response.data['revision'])

        candidate = User.objects.create_user(
            email='preview-candidate@example.com',
            password='Password@123',
            full_name='Trần Thu Hà',
        )
        self.client.force_authenticate(candidate)
        own = self.client.get(
            '/api/v2/cv-position-preview/',
            {
                'position_public_id': self.sample_category.public_id,
                'locale': 'vi-VN',
                'template_public_id': self.primary.public_id,
            },
        )
        personal_info = own.data['document']['content_json']['personal_info']
        self.assertEqual(personal_info['full_name'], 'Trần Thu Hà')
        self.assertNotEqual(personal_info['phone'], DEMO_IDENTITY['vi-VN']['phone'])

    def _generic_sample(self, locale, band, summary):
        content = empty_content(locale)
        content['personal_info']['headline'] = '{position}'
        content['sections'] = [
            {
                'instance_id': 'summary_1',
                'section_key': 'summary',
                'title': 'Career objective',
                'enabled': True,
                'items': [{'item_id': 'summary_item_1', 'value': summary}],
            },
            {
                'instance_id': 'skills_1',
                'section_key': 'skills',
                'title': 'Skills',
                'enabled': True,
                'items': [{'item_id': 'skills_item_1', 'name': '{position} expertise'}],
            },
        ]
        CvSampleContent.objects.update_or_create(
            position_profile=None,
            locale=locale,
            experience_band=band,
            defaults={
                'title': 'Generic',
                'content_json': content,
                'status': CvSampleContent.Status.PUBLISHED,
            },
        )

    def test_position_preview_falls_back_to_generic_content(self):
        position = JobCategory.objects.create(name='Nhân viên CSKH')
        CvPositionProfile.objects.create(
            job_category=position,
            section_preset=[
                {'section_key': 'skills', 'enabled': True},
                {'section_key': 'summary', 'enabled': True},
            ],
        )
        JobCategoryLocalization.objects.bulk_create(
            [
                JobCategoryLocalization(
                    category=position, locale='vi-VN', display_name='Nhân viên CSKH'
                ),
                JobCategoryLocalization(
                    category=position,
                    locale='en-US',
                    display_name='Customer Service Representative',
                ),
            ]
        )
        self._generic_sample('en-US', 'junior', 'Ready for {position}.')

        response = self.client.get(
            '/api/v2/cv-position-preview/',
            {
                'position_public_id': position.public_id,
                'locale': 'en-US',
                'experience_band': 'junior',
            },
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['source'], 'generic')
        self.assertEqual(response.data['experience_band'], 'junior')
        self.assertEqual(response.data['name_vi'], 'Nhân viên CSKH')
        content = response.data['content_json']
        self.assertEqual(content['personal_info']['headline'], 'Customer Service Representative')
        self.assertEqual(
            [item['section_key'] for item in content['sections']], ['skills', 'summary']
        )
        self.assertEqual(
            content['sections'][1]['items'][0]['value'],
            'Ready for Customer Service Representative.',
        )

    def test_position_preview_prefers_the_nearest_experience_band(self):
        self._generic_sample('vi-VN', 'senior', 'Hơn 6 năm làm {position}.')

        senior = self.client.get(
            '/api/v2/cv-position-preview/',
            {
                'position_public_id': self.sample_category.public_id,
                'locale': 'vi-VN',
                'experience_band': 'senior',
            },
        )
        mid = self.client.get(
            '/api/v2/cv-position-preview/',
            {
                'position_public_id': self.sample_category.public_id,
                'locale': 'vi-VN',
                'experience_band': 'mid',
            },
        )
        invalid = self.client.get(
            '/api/v2/cv-position-preview/',
            {
                'position_public_id': self.sample_category.public_id,
                'experience_band': 'principal',
            },
        )

        self.assertEqual(
            (senior.data['source'], senior.data['experience_band']), ('generic', 'senior')
        )
        self.assertIn('Kỹ sư AI/Machine Learning', str(senior.data['content_json']))
        self.assertEqual((mid.data['source'], mid.data['experience_band']), ('curated', 'mid'))
        self.assertEqual(invalid.status_code, 400)

    def test_unsupported_locale_is_rejected_by_catalogue_and_preview(self):
        catalogue = self.client.get('/api/v2/cv-templates/', {'locale': 'ja-JP'})
        preview = self.client.get(
            '/api/v2/cv-position-preview/',
            {
                'position_public_id': self.sample_category.public_id,
                'locale': 'ja-JP',
            },
        )

        self.assertEqual(catalogue.status_code, 400)
        self.assertEqual(preview.status_code, 400)

    def test_admin_template_version_publish_and_snapshot_regenerate_contract(self):
        admin = User.objects.create_user(
            email='cv-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        self.client.force_authenticate(admin)
        create_response = self.client.post(
            f'/api/v2/admin/cv-templates/{self.primary.public_id}/versions/',
            {},
            format='json',
        )
        self.assertEqual(create_response.status_code, 201, create_response.data)
        version_id = create_response.data['id']

        # Checklist xuất bản có test riêng (test_admin_portal); ở đây chỉ kiểm hợp đồng
        # publish → snapshot.
        with (
            patch('apps.cv_templates.api.views.admin.publish_checklist', return_value=[]),
            patch('apps.cv_templates.tasks.generate_template_color_snapshot.delay') as enqueue,
        ):
            with self.captureOnCommitCallbacks(execute=True):
                publish_response = self.client.post(
                    f'/api/v2/admin/cv-templates/{self.primary.public_id}/versions/{version_id}/publish/',
                    {},
                    format='json',
                )
        self.assertEqual(publish_response.status_code, 200, publish_response.data)
        self.primary.refresh_from_db()
        self.assertEqual(self.primary.current_published_version_id, version_id)
        self.assertEqual(
            publish_response.data['version_status'], CvTemplateVersion.VersionStatus.PUBLISHED
        )
        self.assertEqual(enqueue.call_count, 2)

    def test_content_staff_creates_hidden_data_and_cannot_change_lifecycle(self):
        admin = User.objects.create_user(
            email='cv-staff@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        department = Department.objects.create(code='content-cv', name='Nội dung & CV')
        role = AdminRole.objects.create(
            department=department,
            code='staff',
            name='Nhân viên',
        )
        role.permissions.add(
            *[
                AdminPermission.objects.create(
                    code=code,
                    module='cv_template',
                    label=code,
                )
                for code in (
                    'cv_template.view',
                    'cv_template.manage',
                )
            ]
        )
        assign_membership(admin, role, actor=admin)
        self.client.force_authenticate(admin)

        created = self.client.post(
            '/api/v2/admin/cv-categories/',
            {
                'category_type': 'style',
                'name': 'Nội bộ',
                'slug': 'internal-only',
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        created_category = CvCategory.objects.get(public_id=created.data['public_id'])
        self.assertFalse(created_category.is_active)

        explicit_public = self.client.post(
            '/api/v2/admin/cv-categories/',
            {
                'category_type': 'style',
                'name': 'Public',
                'slug': 'public-now',
                'is_active': True,
            },
            format='json',
        )
        self.assertEqual(explicit_public.status_code, 403)
        self.assertEqual(explicit_public.data['code'], 'admin_permission_denied')

        unchanged = self.client.patch(
            f'/api/v2/admin/cv-categories/{created_category.public_id}/',
            {'is_active': False, 'description': 'Có thể chỉnh nội dung'},
            format='json',
        )
        self.assertEqual(unchanged.status_code, 200, unchanged.data)

        archive = self.client.patch(
            f'/api/v2/admin/cv-categories/{self.style.public_id}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(archive.status_code, 403)
        self.style.refresh_from_db()
        self.assertTrue(self.style.is_active)

        # CVT-4: xóa nằm trong quyền quản lý (mục chưa dùng ở đâu).
        deleted = self.client.delete(f'/api/v2/admin/cv-categories/{created_category.public_id}/')
        self.assertEqual(deleted.status_code, 204)

    def test_admin_endpoints_require_admin_role(self):
        response = self.client.get('/api/v2/admin/cv-templates/')
        self.assertIn(response.status_code, {401, 403})

    @patch('apps.cv_templates.tasks._save_once')
    @patch('apps.cv_templates.tasks._first_page_png', return_value=b'png')
    @patch('apps.cv_templates.tasks.render_document_pdf', return_value=b'%PDF-snapshot')
    def test_snapshot_task_is_fingerprinted_and_write_then_swap(self, render, _raster, save_once):
        from apps.cv_templates.tasks import SNAPSHOT_AVATAR_ID, generate_template_color_snapshot

        save_once.side_effect = lambda key, payload: key
        link = self.primary.color_links.select_related('color').order_by('pk').first()
        generate_template_color_snapshot(link.pk)
        link.refresh_from_db()

        # Danh tính minh họa chỉ có trong ảnh mẫu, không ghi vào nội dung mẫu.
        payload = render.call_args.args[0]
        personal_info = payload['document']['content_json']['personal_info']
        self.assertEqual(personal_info['full_name'], DEMO_IDENTITY['vi-VN']['full_name'])
        self.assertIn(SNAPSHOT_AVATAR_ID, payload['assets'])
        self.assertFalse(
            CvSampleContent.objects.filter(
                content_json__personal_info__full_name=personal_info['full_name']
            ).exists()
        )
        self.assertEqual(len(link.snapshot_fingerprint), 64)
        self.assertIn(link.snapshot_fingerprint, link.thumbnail_url)
        self.assertIn(link.snapshot_fingerprint, link.preview_url)
        self.assertIsNotNone(link.snapshot_generated_at)

        generate_template_color_snapshot(link.pk)
        self.assertEqual(save_once.call_count, 2)

    def test_replaced_snapshots_are_deleted_later_and_never_while_still_in_use(self):
        """Hồi quy ảnh vỡ ở kho mẫu: ảnh cũ không bị xóa ngay khi mẫu xuất bản lại."""
        from apps.cv_templates.tasks import STALE_SNAPSHOT_GRACE_SECONDS, delete_stale_snapshot

        link = self.primary.color_links.order_by('pk').first()
        link.thumbnail_url = 'cv-templates/snapshots/tpl/old-thumbnail.png'
        link.save(update_fields=['thumbnail_url'])
        with patch('apps.cv_templates.tasks.public_media_storage') as storage:
            delete_stale_snapshot(link.thumbnail_url)
            delete_stale_snapshot('cv-templates/snapshots/tpl/gone-thumbnail.png')
            delete_stale_snapshot('site/settings/logo.png')

        storage.return_value.delete.assert_called_once_with(
            'cv-templates/snapshots/tpl/gone-thumbnail.png'
        )
        self.assertGreaterEqual(STALE_SNAPSHOT_GRACE_SECONDS, 300)

    def test_published_template_version_and_its_sections_are_immutable(self):
        version = self.primary.current_published_version
        version.default_style_json = {**version.default_style_json, 'theme_color': '#112233'}
        with self.assertRaises(ValidationError):
            version.save()
        version.refresh_from_db()
        self.assertEqual(version.default_style_json['theme_color'], '#00A66A')

        definition = CvSectionDefinition.objects.create(
            section_key='catalog_immutable_section',
            display_name='Catalog immutable section',
        )
        with self.assertRaises(ValidationError):
            CvTemplateSection.objects.create(
                template_version=version,
                section_definition=definition,
                region_key='main',
            )

        version.version_status = CvTemplateVersion.VersionStatus.RETIRED
        version.save(update_fields=['version_status'])
        self.assertEqual(version.version_status, CvTemplateVersion.VersionStatus.RETIRED)

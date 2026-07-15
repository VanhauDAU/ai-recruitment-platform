from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from unittest.mock import patch

from apps.accounts.models import User
from apps.cvs.schemas import empty_content, empty_layout, empty_style
from apps.jobs.models import JobCategory, JobCategoryLocalization

from .management.commands.seed_cv_catalog import build_sample_content
from .models import (
    CvCategory,
    CvColor,
    CvContentBlueprint,
    CvSampleContent,
    CvSectionDefinition,
    CvTemplate,
    CvTemplateCategoryLink,
    CvTemplateColorLink,
    CvTemplateLocalization,
    CvTemplateSection,
    CvTemplateVersion,
)


class TemplateCatalogV2Tests(TestCase):
    def create_template(self, name, *, locale='vi-VN', categories=(), usage_count=0):
        template = CvTemplate.objects.create(
            name=name,
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
            thumbnail_url=f'/templates/{name}.png',
            usage_count=usage_count,
        )
        version = CvTemplateVersion.objects.create(
            template=template,
            version_number=1,
            version_status=CvTemplateVersion.VersionStatus.PUBLISHED,
            renderer_key='classic_single_column_v1',
            renderer_version='1',
            default_layout_json=empty_layout(),
            default_style_json=empty_style(),
            capabilities={'supports_font_scale': True},
        )
        template.current_published_version = version
        template.save(update_fields=['current_published_version'])
        CvTemplateLocalization.objects.create(
            template=template, locale=locale, display_name=f'{name} {locale}', description=f'{name} description',
        )
        for category in categories:
            CvTemplateCategoryLink.objects.create(template=template, category=category)
        green, _ = CvColor.objects.get_or_create(
            hex_code='#00A66A', defaults={'name': 'Xanh', 'slug': 'green'},
        )
        blue, _ = CvColor.objects.get_or_create(
            hex_code='#2255AA', defaults={'name': 'Xanh dương', 'slug': 'blue'},
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
        self.style = CvCategory.objects.create(category_type='style', name='Tối giản', slug='minimal')
        self.audience = CvCategory.objects.create(category_type='audience', name='Chuyên nghiệp', slug='professional')
        self.tag = CvCategory.objects.create(category_type='feature', name='Thân thiện ATS', slug='ats')
        self.primary = self.create_template(
            'Primary', categories=(self.style, self.audience, self.tag), usage_count=10,
        )
        self.related = self.create_template('Related', categories=(self.audience,), usage_count=5)
        self.english = self.create_template('English', locale='en-US')
        self.sample_category = JobCategory.objects.create(name='AI/Machine Learning Engineer', slug='ai-machine-learning-engineer')
        JobCategoryLocalization.objects.create(
            category=self.sample_category,
            locale='vi-VN',
            display_name='Kỹ sư AI/Machine Learning',
        )
        self.sample = CvSampleContent.objects.create(
            job_category=self.sample_category,
            locale='vi-VN',
            title='Mẫu Front-end Developer',
            position_name_vi='Kỹ sư AI/Machine Learning',
            content_json=empty_content('vi-VN'),
            status=CvSampleContent.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        self.client = APIClient()

    def test_list_returns_card_contract_and_filters_locale_category_and_tag(self):
        response = self.client.get('/api/v2/cv-templates/', {
            'locale': 'vi-VN', 'category': 'professional', 'tag': 'ats',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        card = response.data['results'][0]
        self.assertEqual(card['slug'], self.primary.slug)
        self.assertEqual(card['theme_color'], '#00A66A')
        self.assertEqual(
            [(color['slug'], color['preview_url']) for color in card['colors']],
            [('green', '/templates/Primary-green.png'), ('blue', '/templates/Primary-blue.png')],
        )
        self.assertEqual(card['color_variants'], ['#00A66A', '#2255AA'])
        self.assertCountEqual(
            [category['slug'] for category in card['categories']],
            ['minimal', 'professional'],
        )
        self.assertEqual([tag['slug'] for tag in card['tags']], ['ats'])
        self.assertNotIn('default_layout_json', card)
        self.assertNotIn('renderer', card)
        self.assertIn('max-age=300', response['Cache-Control'])
        self.assertIn('ETag', response)

    def test_detail_and_related_only_use_current_published_template_versions(self):
        detail = self.client.get(f'/api/v2/cv-templates/{self.primary.slug}/', {'locale': 'vi-VN'})
        related = self.client.get(f'/api/v2/cv-templates/{self.primary.slug}/related/', {'locale': 'vi-VN'})

        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data['renderer']['key'], 'classic_single_column_v1')
        self.assertNotIn('default_style_json', detail.data)
        self.assertEqual(related.status_code, 200)
        self.assertEqual([item['slug'] for item in related.data], [self.related.slug])
        self.assertEqual(self.client.get(f'/api/v2/cv-templates/{self.english.slug}/', {'locale': 'vi-VN'}).status_code, 404)

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
        self.assertEqual(samples.data[0]['job_category_slug'], 'ai-machine-learning-engineer')
        self.assertEqual(samples.data[0]['position_name_vi'], 'Kỹ sư AI/Machine Learning')
        self.assertEqual(samples.data[0]['position_name'], 'Kỹ sư AI/Machine Learning')
        self.assertNotIn('content_json', samples.data[0])

    def test_seed_localizes_position_content_for_english_preview(self):
        content = build_sample_content('en-US', 'Chăm sóc khách hàng')

        self.assertEqual(content['personal_info']['headline'], 'Customer Service')
        self.assertEqual(content['sections'][1]['items'][0]['role'], 'Customer Service')
        self.assertIn('Customer Service', content['sections'][0]['items'][0]['value'])

    def test_position_picker_uses_specialization_taxonomy_and_selected_locale(self):
        JobCategory.objects.create(
            name='Nhóm không phải vị trí',
            category_type=JobCategory.CategoryType.OCCUPATION_GROUP,
        )

        response = self.client.get('/api/v2/cv-position-options/', {'q': 'Ky su'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [{
            'public_id': self.sample_category.public_id,
            'display_name': 'Kỹ sư AI/Machine Learning',
            'name_vi': 'Kỹ sư AI/Machine Learning',
        }])

    def test_position_preview_can_return_a_composed_template_document(self):
        response = self.client.get('/api/v2/cv-position-preview/', {
            'position_public_id': self.sample_category.public_id,
            'locale': 'vi-VN',
            'template_public_id': self.primary.public_id,
            'theme_color': '#2255AA',
        })

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['document']['content_json'], self.sample.content_json)
        self.assertEqual(response.data['document']['style_json']['theme_color'], '#2255AA')
        self.assertEqual(response.data['renderer']['key'], 'classic_single_column_v1')
        self.assertTrue(response.data['revision'])

    def test_position_preview_falls_back_to_admin_blueprint(self):
        position = JobCategory.objects.create(name='Nhân viên CSKH')
        JobCategoryLocalization.objects.bulk_create([
            JobCategoryLocalization(category=position, locale='vi-VN', display_name='Nhân viên CSKH'),
            JobCategoryLocalization(category=position, locale='en-US', display_name='Customer Service Representative'),
        ])
        CvContentBlueprint.objects.filter(locale='en-US', experience_level='unspecified').update(
            summary_title='Career objective',
            summary_template='Experience as {position}.',
            experience_title='Work experience',
            experience_company='ABC Company',
            experience_description_template='Worked as {position}.',
            education_title='Education',
            education_degree='Bachelor degree',
            education_institution='University',
            education_description='Graduated.',
            skills_title='Skills',
            skill_templates=['{position} expertise'],
            content_json_template={
                'schema_version': 1,
                'locale': 'en-US',
                'personal_info': {
                    'full_name': '', 'headline': '{position}', 'email': '', 'phone': '',
                    'address': '', 'avatar_asset_id': None, 'links': [],
                },
                'sections': [{
                    'instance_id': 'summary_1', 'section_key': 'summary',
                    'title': 'Career objective', 'enabled': True,
                    'items': [{'item_id': 'summary_item_1', 'value': 'Ready for {position}.'}],
                }],
                'custom_fields': {},
            },
            is_active=True,
        )

        response = self.client.get('/api/v2/cv-position-preview/', {
            'position_public_id': position.public_id,
            'locale': 'en-US',
        })

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['source'], 'blueprint')
        self.assertEqual(response.data['name_vi'], 'Nhân viên CSKH')
        self.assertEqual(response.data['content_json']['personal_info']['headline'], 'Customer Service Representative')
        self.assertEqual(
            response.data['content_json']['sections'][0]['items'][0]['value'],
            'Ready for Customer Service Representative.',
        )

    def test_inactive_locale_is_rejected_by_catalogue_and_preview(self):
        from apps.sitecontent.models import Locale

        Locale.objects.filter(code='en-US').update(is_active=False)
        catalogue = self.client.get('/api/v2/cv-templates/', {'locale': 'en-US'})
        preview = self.client.get('/api/v2/cv-position-preview/', {
            'position_public_id': self.sample_category.public_id,
            'locale': 'en-US',
        })

        self.assertEqual(catalogue.status_code, 400)
        self.assertEqual(preview.status_code, 400)

    def test_admin_template_version_publish_and_snapshot_regenerate_contract(self):
        admin = User.objects.create_user(
            email='cv-admin@example.com', password='Password@123', role=User.Role.ADMIN,
        )
        self.client.force_authenticate(admin)
        create_response = self.client.post(
            f'/api/v2/admin/cv-templates/{self.primary.public_id}/versions/',
            {}, format='json',
        )
        self.assertEqual(create_response.status_code, 201, create_response.data)
        version_id = create_response.data['id']

        with patch('apps.cv_templates.tasks.generate_template_color_snapshot.delay') as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                publish_response = self.client.post(
                    f'/api/v2/admin/cv-templates/{self.primary.public_id}/versions/{version_id}/publish/',
                    {}, format='json',
                )
        self.assertEqual(publish_response.status_code, 200, publish_response.data)
        self.primary.refresh_from_db()
        self.assertEqual(self.primary.current_published_version_id, version_id)
        self.assertEqual(publish_response.data['version_status'], CvTemplateVersion.VersionStatus.PUBLISHED)
        self.assertEqual(enqueue.call_count, 2)

    def test_admin_endpoints_require_admin_role(self):
        response = self.client.get('/api/v2/admin/cv-templates/')
        self.assertIn(response.status_code, {401, 403})

    @patch('apps.cv_templates.tasks._save_once')
    @patch('apps.cv_templates.tasks._first_page_png', return_value=b'png')
    @patch('apps.cv_templates.tasks.render_cv_version_pdf', return_value=b'%PDF-snapshot')
    def test_snapshot_task_is_fingerprinted_and_write_then_swap(self, _render, _raster, save_once):
        from apps.cv_templates.tasks import generate_template_color_snapshot

        save_once.side_effect = lambda key, payload: key
        link = self.primary.color_links.select_related('color').order_by('pk').first()
        generate_template_color_snapshot(link.pk)
        link.refresh_from_db()

        self.assertEqual(len(link.snapshot_fingerprint), 64)
        self.assertIn(link.snapshot_fingerprint, link.thumbnail_url)
        self.assertIn(link.snapshot_fingerprint, link.preview_url)
        self.assertIsNotNone(link.snapshot_generated_at)

        generate_template_color_snapshot(link.pk)
        self.assertEqual(save_once.call_count, 2)

    def test_published_template_version_and_its_sections_are_immutable(self):
        version = self.primary.current_published_version
        version.default_style_json = {**version.default_style_json, 'theme_color': '#112233'}
        with self.assertRaises(ValidationError):
            version.save()
        version.refresh_from_db()
        self.assertEqual(version.default_style_json['theme_color'], '#00A66A')

        definition = CvSectionDefinition.objects.create(
            section_key='catalog_immutable_section', display_name='Catalog immutable section',
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

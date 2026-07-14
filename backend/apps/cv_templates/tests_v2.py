from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.cvs.schemas import empty_content, empty_layout, empty_style

from .models import (
    CvCategory,
    CvColor,
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
        self.sample = CvSampleContent.objects.create(
            locale='vi-VN',
            title='Mẫu Front-end Developer',
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
        categories = self.client.get('/api/v2/cv-categories/', {'type': 'feature'})
        samples = self.client.get('/api/v2/cv-sample-contents/', {'locale': 'vi-VN'})

        self.assertEqual(categories.status_code, 200)
        self.assertEqual([item['slug'] for item in categories.data], ['ats'])
        self.assertEqual(samples.status_code, 200)
        self.assertEqual(samples.data[0]['public_id'], self.sample.public_id)
        self.assertNotIn('content_json', samples.data[0])

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

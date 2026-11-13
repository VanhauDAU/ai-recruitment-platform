"""Vị trí, trường riêng và API quản trị vị trí CV (CVT-3)."""

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.cvs.models import UserCv
from apps.cvs.schemas import empty_content
from apps.jobs.models import Job, JobCategory, JobCategoryLocalization

from ..models import CvPositionField, CvPositionProfile, CvSampleContent
from ..services import resolve_position_content


def make_position(name, slug, fields=(), preset=()):
    category = JobCategory.objects.create(name=name, slug=slug)
    JobCategoryLocalization.objects.create(category=category, locale='vi-VN', display_name=name)
    JobCategoryLocalization.objects.create(category=category, locale='en-US', display_name=name)
    profile = CvPositionProfile.objects.create(job_category=category, section_preset=list(preset))
    for order, (key, field_type, extra) in enumerate(fields):
        CvPositionField.objects.create(
            profile=profile,
            key=key,
            label_vi=f'{key} vi',
            label_en=f'{key} en',
            field_type=field_type,
            sort_order=order,
            **extra,
        )
    return category, profile


def generic_sample(locale='vi-VN', band='junior'):
    content = empty_content(locale)
    content['personal_info']['headline'] = '{position}'
    content['sections'] = [
        {
            'instance_id': 'summary_1',
            'section_key': 'summary',
            'title': 'Mục tiêu',
            'enabled': True,
            'items': [{'item_id': 'summary_item_1', 'value': 'Làm {position}.'}],
        },
        {
            'instance_id': 'experience_1',
            'section_key': 'experience',
            'title': 'Kinh nghiệm',
            'enabled': True,
            'items': [{'item_id': 'experience_item_1', 'role': '{position}'}],
        },
        {
            'instance_id': 'skills_1',
            'section_key': 'skills',
            'title': 'Kỹ năng',
            'enabled': True,
            'items': [{'item_id': 'skills_item_1', 'name': 'Giao tiếp', 'level': ''}],
        },
    ]
    return CvSampleContent.objects.create(
        locale=locale,
        experience_band=band,
        title='Chung',
        content_json=content,
        status=CvSampleContent.Status.PUBLISHED,
        published_at=timezone.now(),
    )


SALES_OPTIONS = {'options': [{'vi': 'Shopee', 'en': 'Shopee'}, {'vi': 'Zalo', 'en': 'Zalo'}]}


class PositionFieldModelTests(TestCase):
    def test_choice_fields_need_bilingual_options_and_only_lists_map_to_skills(self):
        _, profile = make_position('Lập trình viên', 'lap-trinh-vien')
        invalid = [
            CvPositionField(profile=profile, key='a', field_type='select', options=[]),
            CvPositionField(profile=profile, key='b', field_type='select', options=[{'vi': 'x'}]),
            CvPositionField(
                profile=profile, key='c', field_type='text', options=[{'vi': 'x', 'en': 'x'}]
            ),
            CvPositionField(profile=profile, key='d', field_type='url', maps_to='skills'),
        ]
        for field in invalid:
            with self.subTest(key=field.key), self.assertRaises(ValidationError):
                field.clean()


class PositionContentTests(TestCase):
    def setUp(self):
        generic_sample()
        self.developer, _ = make_position(
            'Kỹ sư phần mềm',
            'ky-su-phan-mem',
            fields=[('github_url', 'url', {}), ('tech_stack', 'tags', {'maps_to': 'skills'})],
            preset=[
                {'section_key': 'summary', 'enabled': True},
                {'section_key': 'skills', 'enabled': True},
                {'section_key': 'experience', 'enabled': True},
            ],
        )
        self.sales, _ = make_position(
            'Nhân viên kinh doanh',
            'nhan-vien-kinh-doanh',
            fields=[('sales_channels', 'multi_select', SALES_OPTIONS)],
        )

    def resolve(self, position):
        content = resolve_position_content(
            position=position, locale='vi-VN', experience_band='junior'
        )['content_json']
        return content['sections']

    def test_positions_get_different_section_sets_and_their_own_fields(self):
        developer = self.resolve(self.developer)
        sales = self.resolve(self.sales)

        self.assertEqual(
            [section['section_key'] for section in developer],
            ['summary', 'skills', 'position_details', 'experience'],
        )
        self.assertEqual(
            [section['section_key'] for section in sales],
            ['summary', 'experience', 'skills', 'position_details'],
        )
        developer_fields = developer[2]['items']
        self.assertEqual(
            [(item['field_key'], item['field_type'], item['label']) for item in developer_fields],
            [('github_url', 'url', 'github_url vi'), ('tech_stack', 'tags', 'tech_stack vi')],
        )
        self.assertEqual(developer_fields[1]['maps_to'], 'skills')
        self.assertEqual(sales[3]['items'][0]['options'], ['Shopee', 'Zalo'])

    def test_inactive_fields_are_left_out_and_a_position_without_fields_has_no_section(self):
        CvPositionField.objects.filter(key='sales_channels').update(is_active=False)

        self.assertNotIn(
            'position_details', [section['section_key'] for section in self.resolve(self.sales)]
        )

    def test_public_details_endpoint_returns_the_localized_skeleton(self):
        client = APIClient()
        english = client.get(
            '/api/v2/cv-position-details/',
            {'position_public_id': self.sales.public_id, 'locale': 'en-US'},
        )
        unknown = client.get('/api/v2/cv-position-details/', {'position_public_id': 'missing'})

        self.assertEqual(english.status_code, 200)
        section = english.data['section']
        self.assertEqual(section['title'], 'Professional details')
        self.assertEqual(section['items'][0]['label'], 'sales_channels en')
        self.assertEqual(section['items'][0]['value'], [])
        self.assertIsNone(unknown.data['section'])


class CvTargetPositionTests(TestCase):
    def setUp(self):
        self.position, _ = make_position('Kế toán', 'ke-toan')
        self.user = get_user_model().objects.create_user(
            email='target-candidate@example.com', password='password', role='candidate'
        )
        self.cv = UserCv.objects.create(
            user=self.user, cv_type=UserCv.CvType.BUILDER, source=UserCv.Source.BUILDER, title='CV'
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_candidate_sets_and_clears_target_position_and_level(self):
        url = f'/api/v2/cvs/{self.cv.public_id}/'
        response = self.client.patch(
            url,
            {
                'position_public_id': self.position.public_id,
                'position_level': Job.PositionLevel.TEAM_LEAD,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['position_public_id'], self.position.public_id)
        self.assertEqual(response.data['position_level'], Job.PositionLevel.TEAM_LEAD)

        cleared = self.client.patch(url, {'position_public_id': None}, format='json')
        self.assertIsNone(cleared.data['position_public_id'])
        self.assertEqual(cleared.data['position_level'], Job.PositionLevel.TEAM_LEAD)

    def test_unknown_position_or_level_is_rejected(self):
        url = f'/api/v2/cvs/{self.cv.public_id}/'
        self.assertEqual(
            self.client.patch(url, {'position_public_id': 'missing'}, format='json').status_code,
            400,
        )
        self.assertEqual(
            self.client.patch(url, {'position_level': 'ceo'}, format='json').status_code, 400
        )


class AdminPositionApiTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user(
            email='cv-position-admin@example.com',
            password='Password@123',
            role='admin',
            is_superuser=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.position, self.profile = make_position(
            'Nhân viên kinh doanh',
            'nhan-vien-kinh-doanh',
            fields=[('sales_channels', 'multi_select', SALES_OPTIONS)],
        )

    def test_profile_keywords_and_preset_are_validated(self):
        url = f'/api/v2/admin/cv-positions/{self.profile.public_id}/'
        ok = self.client.patch(url, {'keywords': ['Đàm phán', 'CRM']}, format='json')
        bad = self.client.patch(
            url, {'section_preset': [{'section_key': 'unknown'}]}, format='json'
        )

        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data['keywords'], ['Đàm phán', 'CRM'])
        self.assertEqual(ok.data['field_count'], 1)
        self.assertEqual(bad.status_code, 400)

    def test_fields_crud_rejects_duplicate_keys_and_invalid_options(self):
        payload = {
            'position_public_id': self.position.public_id,
            'key': 'best_revenue',
            'label_vi': 'Doanh số',
            'label_en': 'Revenue',
            'field_type': 'text',
        }
        created = self.client.post('/api/v2/admin/cv-position-fields/', payload, format='json')
        duplicate = self.client.post('/api/v2/admin/cv-position-fields/', payload, format='json')
        no_options = self.client.post(
            '/api/v2/admin/cv-position-fields/',
            {**payload, 'key': 'segment', 'field_type': 'select'},
            format='json',
        )
        listed = self.client.get(
            '/api/v2/admin/cv-position-fields/', {'position': self.position.public_id}
        )

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(no_options.status_code, 400)
        self.assertEqual(
            [field['key'] for field in listed.data], ['sales_channels', 'best_revenue']
        )

    def test_coverage_marks_published_pending_and_generic_cells(self):
        CvSampleContent.objects.create(
            position_profile=self.profile,
            locale='vi-VN',
            experience_band='mid',
            title='Đã xuất bản',
            content_json=empty_content('vi-VN'),
            status=CvSampleContent.Status.PUBLISHED,
        )
        CvSampleContent.objects.create(
            position_profile=self.profile,
            locale='en-US',
            experience_band='mid',
            title='Chờ duyệt',
            content_json=empty_content('en-US'),
            status=CvSampleContent.Status.IN_REVIEW,
        )

        response = self.client.get('/api/v2/admin/cv-positions/coverage/')

        coverage = response.data['results'][0]['coverage']
        self.assertEqual(coverage['vi-VN']['mid'], 'published')
        self.assertEqual(coverage['en-US']['mid'], 'pending')
        self.assertEqual(coverage['vi-VN']['entry'], 'generic')

    def test_export_then_import_round_trips_and_imports_samples_as_drafts(self):
        CvSampleContent.objects.create(
            position_profile=self.profile,
            locale='vi-VN',
            experience_band='junior',
            title='Mẫu',
            content_json=empty_content('vi-VN'),
            status=CvSampleContent.Status.PUBLISHED,
        )
        exported = self.client.get('/api/v2/admin/cv-positions/export/').data
        exported['positions'][0]['keywords'] = ['Mới']
        exported['positions'][0]['fields'][0]['label_vi'] = 'Kênh bán'

        imported = self.client.post('/api/v2/admin/cv-positions/import/', exported, format='json')

        self.assertEqual(imported.status_code, 201, imported.data)
        self.assertEqual(imported.data, {'positions': 1, 'samples': 1})
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.keywords, ['Mới'])
        self.assertEqual(self.profile.fields.get().label_vi, 'Kênh bán')
        draft = CvSampleContent.objects.get(status=CvSampleContent.Status.DRAFT)
        self.assertEqual(draft.origin, CvSampleContent.Origin.IMPORT)

    def test_invalid_import_changes_nothing(self):
        payload = {
            'format': 'cv-positions-v1',
            'positions': [
                {'job_category_slug': 'nhan-vien-kinh-doanh', 'keywords': ['Hợp lệ']},
                {'job_category_slug': 'khong-ton-tai'},
            ],
        }

        response = self.client.post('/api/v2/admin/cv-positions/import/', payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.keywords, [])

    def test_position_endpoints_require_admin(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/v2/admin/cv-positions/').status_code, {401, 403})

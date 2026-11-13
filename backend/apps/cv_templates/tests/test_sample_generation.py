"""Sinh nội dung CV mẫu bằng AI và duyệt (CVT-3). Provider AI luôn được giả lập."""

from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.ai_core.services import AiGenerationError
from apps.cvs.schemas import empty_content

from ..models import CvSampleContent, CvSampleGeneration
from ..services.sample_generation import (
    _validate_generated,
    build_prompt,
    contains_personal_data,
    execute_sample_generation,
    generated_content,
)
from .test_positions import SALES_OPTIONS, make_position

AI_READY = {'AI_RUNTIME_ENABLED': True, 'GEMINI_API_KEY': 'test-key'}


def ai_response(**overrides):
    return {
        'headline': 'Nhân viên kinh doanh',
        'summary': 'Hai năm bán hàng đa kênh, vượt chỉ tiêu doanh số mỗi quý.',
        'experience': [
            {
                'role': 'Nhân viên kinh doanh',
                'company': 'Công ty Thương mại ABC',
                'start_date': '2024-01',
                'end_date': '',
                'highlights': ['Quản lý 200 khách hàng', 'Đạt 120% chỉ tiêu năm 2025'],
            }
        ],
        'education': [
            {
                'degree': 'Cử nhân Quản trị kinh doanh',
                'institution': 'Trường Đại học Kinh tế',
                'degree_level': 'university',
                'start_date': '2019-09',
                'end_date': '2023-06',
            }
        ],
        'skills': [{'name': 'Đàm phán', 'level': 4}, {'name': 'CRM', 'level': 3}],
        'position_details': [
            {'field_key': 'sales_channels', 'values': ['Shopee', 'Không có trong lựa chọn']},
            {'field_key': 'best_revenue', 'text': 'Vượt 120% chỉ tiêu năm'},
            {'field_key': 'store_url', 'text': 'bịa liên kết'},
        ],
        **overrides,
    }


class SampleGenerationContentTests(TestCase):
    def setUp(self):
        self.category, self.profile = make_position(
            'Nhân viên kinh doanh',
            'nhan-vien-kinh-doanh',
            fields=[
                ('sales_channels', 'multi_select', SALES_OPTIONS),
                ('best_revenue', 'text', {}),
                ('store_url', 'url', {}),
            ],
        )
        self.profile.keywords = ['Đàm phán', 'CRM']
        self.profile.save()

    def test_prompt_lists_language_band_keywords_and_fields(self):
        prompt = build_prompt(self.profile, 'en-US', 'senior')

        self.assertIn('English', prompt)
        self.assertIn('5+ years', prompt)
        self.assertIn('Đàm phán, CRM', prompt)
        self.assertIn('sales_channels', prompt)
        self.assertIn('Shopee, Zalo', prompt)

    def test_response_becomes_a_valid_identity_free_document(self):
        content = generated_content(self.profile, 'vi-VN', ai_response())

        self.assertEqual(content['personal_info']['full_name'], '')
        self.assertEqual(content['personal_info']['email'], '')
        keys = [section['section_key'] for section in content['sections']]
        self.assertEqual(keys, ['summary', 'experience', 'education', 'skills', 'position_details'])
        details = {item['field_key']: item['value'] for item in content['sections'][-1]['items']}
        # Lựa chọn ngoài danh sách bị bỏ; AI không được điền liên kết.
        self.assertEqual(details['sales_channels'], ['Shopee'])
        self.assertEqual(details['best_revenue'], 'Vượt 120% chỉ tiêu năm')
        self.assertEqual(details['store_url'], '')
        self.assertIsNone(content['sections'][1]['items'][0]['end_date'])

    def test_personal_data_in_any_text_is_detected(self):
        for text in (
            'Liên hệ an@gmail.com',
            'Gọi 0901 234 567',
            'Xem https://linkedin.com/in/an',
            'www.example.vn',
        ):
            with self.subTest(text=text):
                self.assertTrue(contains_personal_data(ai_response(summary=text)))
                with self.assertRaises(AiGenerationError):
                    _validate_generated(ai_response(summary=text))
        self.assertFalse(contains_personal_data(ai_response()))


class SampleGenerationFlowTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user(
            email='cv-ai-admin@example.com',
            password='Password@123',
            role='admin',
            is_superuser=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.category, self.profile = make_position(
            'Nhân viên kinh doanh',
            'nhan-vien-kinh-doanh',
            fields=[
                ('sales_channels', 'multi_select', SALES_OPTIONS),
                ('best_revenue', 'text', {}),
            ],
        )

    def request(self, **overrides):
        payload = {
            'position_public_ids': [self.category.public_id],
            'locales': ['vi-VN', 'en-US'],
            'experience_bands': ['junior', 'mid'],
            **overrides,
        }
        return self.client.post(
            '/api/v2/admin/cv-sample-contents/generate/', payload, format='json'
        )

    @override_settings(AI_RUNTIME_ENABLED=False)
    def test_generation_is_refused_while_the_ai_runtime_is_off(self):
        response = self.request()

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'runtime_disabled')
        self.assertFalse(CvSampleGeneration.objects.exists())

    @override_settings(**AI_READY)
    def test_batch_queues_one_generation_per_combination_after_commit(self):
        with (
            patch('apps.cv_templates.tasks.generate_cv_sample_content.delay') as delay,
            self.captureOnCommitCallbacks(execute=True),
        ):
            response = self.request()

        self.assertEqual(response.status_code, 202, response.data)
        self.assertEqual(len(response.data['generations']), 4)
        self.assertEqual(delay.call_count, 4)
        listed = self.client.get(
            '/api/v2/admin/cv-sample-generations/', {'batch': response.data['batch_id']}
        )
        self.assertEqual({row['status'] for row in listed.data}, {'queued'})

    @override_settings(**AI_READY)
    def test_batch_size_and_concurrent_generations_are_capped_at_sixteen(self):
        others = [
            make_position(f'Vị trí {index}', f'vi-tri-{index}')[0].public_id for index in range(2)
        ]
        every_band = ['entry', 'junior', 'mid', 'senior']

        too_large = self.request(
            position_public_ids=[self.category.public_id, *others], experience_bands=every_band
        )
        full = self.request(
            position_public_ids=[self.category.public_id, others[0]], experience_bands=every_band
        )
        while_busy = self.request(experience_bands=['entry'])

        self.assertEqual(too_large.status_code, 400)
        self.assertEqual(too_large.data['code'], 'batch_too_large')
        self.assertEqual(full.status_code, 202)
        self.assertEqual(len(full.data['generations']), 16)
        self.assertEqual(while_busy.status_code, 409)
        self.assertEqual(while_busy.data['code'], 'generation_in_progress')

    def generation(self):
        return CvSampleGeneration.objects.create(
            batch_id='cvbatch_test',
            position_profile=self.profile,
            locale='vi-VN',
            experience_band='junior',
            requested_by=self.admin,
        )

    def test_successful_generation_creates_content_waiting_for_review(self):
        generation = self.generation()
        result = SimpleNamespace(data=ai_response(), invocation_id=None)

        with patch('apps.ai_core.services.generate_structured', return_value=result) as call:
            sample = execute_sample_generation(generation.pk)

        self.assertEqual(call.call_args.kwargs['use_case'], 'cv_sample_content')
        self.assertEqual(call.call_args.kwargs['correlation_key'], generation.public_id)
        generation.refresh_from_db()
        self.assertEqual(generation.status, CvSampleGeneration.Status.COMPLETED)
        self.assertEqual(generation.sample, sample)
        self.assertEqual(sample.status, CvSampleContent.Status.IN_REVIEW)
        self.assertEqual(sample.origin, CvSampleContent.Origin.AI)
        # Chạy lại một lượt đã xong không sinh thêm nội dung.
        self.assertIsNone(execute_sample_generation(generation.pk))

    def test_failed_generation_keeps_only_a_safe_code(self):
        generation = self.generation()
        samples_before = CvSampleContent.objects.count()

        with patch(
            'apps.ai_core.services.generate_structured',
            side_effect=AiGenerationError('personal_data_detected'),
        ):
            self.assertIsNone(execute_sample_generation(generation.pk))

        generation.refresh_from_db()
        self.assertEqual(generation.status, CvSampleGeneration.Status.FAILED)
        self.assertEqual(generation.failure_code, 'personal_data_detected')
        self.assertEqual(CvSampleContent.objects.count(), samples_before)

    def test_approving_ai_content_replaces_the_published_sample(self):
        old = CvSampleContent.objects.create(
            position_profile=self.profile,
            locale='vi-VN',
            experience_band='junior',
            title='Cũ',
            content_json=empty_content('vi-VN'),
            status=CvSampleContent.Status.PUBLISHED,
            published_at=timezone.now(),
        )
        reviewed = CvSampleContent.objects.create(
            position_profile=self.profile,
            locale='vi-VN',
            experience_band='junior',
            title='AI',
            content_json=generated_content(self.profile, 'vi-VN', ai_response()),
            status=CvSampleContent.Status.IN_REVIEW,
            origin=CvSampleContent.Origin.AI,
        )

        with patch('apps.cv_templates.api.views.admin.regenerate_all_template_snapshots'):
            response = self.client.post(
                f'/api/v2/admin/cv-sample-contents/{reviewed.public_id}/publish/'
            )

        self.assertEqual(response.status_code, 200, response.data)
        old.refresh_from_db()
        reviewed.refresh_from_db()
        self.assertEqual(old.status, CvSampleContent.Status.ARCHIVED)
        self.assertEqual(reviewed.status, CvSampleContent.Status.PUBLISHED)
        self.assertEqual(reviewed.reviewed_by, self.admin)
        self.assertIsNotNone(reviewed.reviewed_at)

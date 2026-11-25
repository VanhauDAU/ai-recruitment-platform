"""AI tạo tin: quyền lợi (brief + luật định), ngoại ngữ, lương/số lượng chỉ từ JD."""

import json

from django.utils import timezone
from rest_framework.test import APITestCase

from ..models import Benefit, JobAiGeneration, Language
from ..services.ai_generation import create_job_ai_generation
from ..services.ai_generation.prompt import STATUTORY_BENEFITS, generation_prompt
from ..services.ai_generation.suggestion import normalize_ai_suggestion
from .test_ai_generation import JobAiGenerationFixture

BASE_PAYLOAD = {
    'title': 'Backend Engineer',
    'description_bullets': ['Xây dựng API'],
    'requirements_bullets': ['Thành thạo Python'],
    'benefits_bullets': [],
    'work_types': [],
    'employment_type': '',
    'experience_years': '',
    'position_level': '',
    'education_level': '',
    'primary_specialization': '',
    'domain_knowledge': [],
    'required_skills': [],
    'preferred_skills': [],
    'benefit_tags': [],
    'language_requirements': [],
    'number_of_vacancies': 0,
    'salary': {'type': '', 'min': 0, 'max': 0, 'currency': ''},
}
STATUTORY_VI = STATUTORY_BENEFITS['vi-VN']


def payload(**overrides):
    return {**BASE_PAYLOAD, **overrides}


class JobAiGenerationFieldTests(JobAiGenerationFixture, APITestCase):
    def brief_generation(self, *, employment_type='', benefits=(), notes=''):
        brief = {
            'position': 'Backend Engineer',
            'responsibilities': ['Xây dựng API'],
            'requirements': ['Có kinh nghiệm Python'],
            'benefits': list(benefits),
            'notes': notes,
        }
        if employment_type:
            brief['employment_type'] = employment_type
        generation, _, _ = create_job_ai_generation(
            user=self.user,
            validated_data={
                'mode': 'ai_brief',
                'idempotency_key': f'brief-{employment_type}-{len(benefits)}-{len(notes)}',
                'locale': 'vi-VN',
                'brief': brief,
            },
        )
        return generation

    def jd_generation(self, source_text):
        return JobAiGeneration.objects.create(
            owner=self.user,
            company=self.company,
            mode=JobAiGeneration.Mode.JD_TEXT,
            sanitized_input={'source_text': source_text},
            idempotency_key=f'jd-{abs(hash(source_text))}',
            request_hash='b' * 64,
            quota_day=timezone.localdate(),
        )

    # ---- quyền lợi ----

    def test_brief_keeps_entered_benefits_and_statutory_benefits_only(self):
        insurance, _ = Benefit.objects.get_or_create(name='Bảo hiểm xã hội')
        generation = self.brief_generation(
            employment_type='full_time',
            benefits=['Lương tháng 13'],
            notes='Có xe đưa đón nhân viên',
        )
        proposed = [
            *STATUTORY_VI,
            'Được nhận lương tháng 13 theo quy định công ty',
            'Xe đưa đón nhân viên',
            'Du lịch nước ngoài',
        ]

        suggestion, warnings, _ = normalize_ai_suggestion(
            generation,
            payload(benefits_bullets=proposed, benefit_tags=[insurance.name]),
            company_context={},
        )

        for item in (*STATUTORY_VI, 'Được nhận lương tháng 13', 'Xe đưa đón nhân viên'):
            self.assertIn(item, suggestion['benefits'])
        self.assertNotIn('Du lịch nước ngoài', suggestion['benefits'])
        self.assertIn('benefits_without_source_removed', warnings)
        self.assertEqual(suggestion['job_benefits'][0]['benefit'], insurance.pk)

    def test_statutory_benefits_are_not_assumed_for_internships(self):
        generation = self.brief_generation(employment_type='internship')

        suggestion, _, _ = normalize_ai_suggestion(
            generation, payload(benefits_bullets=list(STATUTORY_VI)), company_context={}
        )

        self.assertEqual(suggestion['benefits'], '')

    def test_prompt_lists_statutory_benefits_for_brief_but_not_for_jd(self):
        brief = self.brief_generation(employment_type='full_time')
        jd = self.jd_generation('Tuyển Backend Engineer, lương 15 - 20 triệu.')

        brief_data = json.loads(
            generation_prompt(brief, {}).split('<generation_data>\n')[1].split('\n</')[0]
        )
        jd_data = json.loads(
            generation_prompt(jd, {}).split('<generation_data>\n')[1].split('\n</')[0]
        )

        self.assertEqual(brief_data['statutory_benefits'], list(STATUTORY_VI))
        self.assertEqual(jd_data['statutory_benefits'], [])
        self.assertIn('languages', brief_data['trusted_catalog'])

    # ---- lương / số lượng ----

    def test_jd_salary_and_vacancies_are_copied_when_the_jd_states_them(self):
        generation = self.jd_generation(
            'Tuyển 3 Backend Engineer. Mức lương: 15 - 20 triệu/tháng. Phúc lợi: BHXH đầy đủ.'
        )

        suggestion, warnings, _ = normalize_ai_suggestion(
            generation,
            payload(
                number_of_vacancies=3,
                salary={'type': 'range', 'min': 15_000_000, 'max': 20_000_000, 'currency': 'VND'},
            ),
            company_context={},
        )

        self.assertEqual(suggestion['number_of_vacancies'], 3)
        self.assertEqual(suggestion['salary_type'], 'range')
        self.assertEqual(suggestion['salary_min'], 15_000_000)
        self.assertEqual(suggestion['salary_max'], 20_000_000)
        self.assertEqual(suggestion['currency'], 'VND')
        self.assertNotIn('salary_without_source_removed', warnings)

    def test_jd_salary_written_in_full_or_usd_thousands_is_grounded(self):
        cases = [
            ('Lương 12.000.000 VNĐ', {'type': 'fixed', 'min': 12_000_000, 'currency': 'VND'}),
            ('Salary up to 1,500 USD', {'type': 'up_to', 'max': 1500, 'currency': 'USD'}),
            ('Salary from 2k USD', {'type': 'from', 'min': 2000, 'currency': 'USD'}),
        ]
        for source, salary in cases:
            with self.subTest(source=source):
                generation = self.jd_generation(source)
                proposed = {'min': 0, 'max': 0, **salary}

                suggestion, _, _ = normalize_ai_suggestion(
                    generation, payload(salary=proposed), company_context={}
                )

                self.assertEqual(suggestion['salary_type'], salary['type'])

    def test_invented_salary_and_vacancies_are_dropped(self):
        generation = self.jd_generation('Tuyển Backend Engineer, lương cạnh tranh.')

        suggestion, warnings, _ = normalize_ai_suggestion(
            generation,
            payload(
                number_of_vacancies=5,
                salary={'type': 'range', 'min': 25_000_000, 'max': 30_000_000, 'currency': 'VND'},
            ),
            company_context={},
        )

        self.assertIsNone(suggestion['number_of_vacancies'])
        self.assertNotIn('salary_type', suggestion)
        self.assertIn('salary_without_source_removed', warnings)
        self.assertIn('vacancies_without_source_removed', warnings)

    def test_brief_never_carries_salary_or_vacancies(self):
        generation = self.brief_generation(notes='Lương 15 triệu, tuyển 2 người')

        suggestion, _, _ = normalize_ai_suggestion(
            generation,
            payload(
                number_of_vacancies=2,
                salary={'type': 'fixed', 'min': 15_000_000, 'max': 0, 'currency': 'VND'},
            ),
            company_context={},
        )

        self.assertIsNone(suggestion['number_of_vacancies'])
        self.assertNotIn('salary_type', suggestion)

    def test_negotiable_salary_needs_the_jd_to_say_so(self):
        stated = self.jd_generation('Lương: thỏa thuận theo năng lực')
        silent = self.jd_generation('Tuyển Backend Engineer')
        proposed = payload(salary={'type': 'negotiable', 'min': 0, 'max': 0, 'currency': ''})

        stated_suggestion, _, _ = normalize_ai_suggestion(stated, proposed, company_context={})
        silent_suggestion, _, _ = normalize_ai_suggestion(silent, proposed, company_context={})

        self.assertEqual(stated_suggestion['salary_type'], 'negotiable')
        self.assertNotIn('salary_type', silent_suggestion)

    # ---- ngoại ngữ ----

    def test_language_requirements_map_to_the_catalog(self):
        english, _ = Language.objects.get_or_create(name='Tiếng Anh', defaults={'code': 'en'})
        generation = self.jd_generation('Yêu cầu tiếng Anh giao tiếp tốt.')

        suggestion, _, unresolved = normalize_ai_suggestion(
            generation,
            payload(
                language_requirements=[
                    {'language': 'tieng anh', 'proficiency_level': 'conversational'},
                    {'language': 'Tiếng Anh', 'proficiency_level': 'native'},
                    {'language': 'Tiếng Klingon', 'proficiency_level': 'basic'},
                ]
            ),
            company_context={},
        )

        self.assertEqual(
            suggestion['language_requirements'],
            [
                {
                    'language': english.pk,
                    'language_name': english.name,
                    'proficiency_level': 'conversational',
                    'sort_order': 0,
                }
            ],
        )
        self.assertEqual(unresolved['languages'], ['Tiếng Klingon'])

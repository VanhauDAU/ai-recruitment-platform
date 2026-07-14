from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company
from apps.locations.models import Location
from apps.skills.models import Skill, SkillGroup

from ..api.serializers import EmployerJobWriteSerializer, JobDetailSerializer
from ..models import Benefit, Job, JobCategory, Language


class JobCategoryApiTests(APITestCase):
    def test_category_catalog_is_returned_in_one_unpaginated_response(self):
        JobCategory.objects.create(name='Kế toán')
        JobCategory.objects.create(name='Lập trình')

        response = self.client.get(reverse('job-category-list'), {'all': '1'})

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertEqual({item['name'] for item in response.data}, {'Kế toán', 'Lập trình'})
        self.assertEqual(
            set(response.data[0]),
            {'id', 'name', 'logo_url', 'parent', 'category_type'},
        )


class JobSuggestionApiTests(APITestCase):
    def test_suggest_returns_matching_active_job_titles(self):
        user = User.objects.create_user(
            email='suggest-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        company = Company.objects.create(company_name='Acme', created_by=user)
        Job.objects.create(
            posted_by=user,
            company=company,
            title='Nhân viên chăm sóc khách hàng',
            description='Description',
            status=Job.Status.ACTIVE,
        )

        response = self.client.get(reverse('job-suggest'), {'q': 'nhan'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['suggestions'], ['Nhân viên chăm sóc khách hàng'])


class JobViewTrackingApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='view-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(company_name='Views Inc.', created_by=self.user)
        self.job = Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title='Backend Engineer',
            description='Build reliable APIs.',
            status=Job.Status.ACTIVE,
        )

    def test_get_detail_has_no_view_count_side_effect(self):
        response = self.client.get(reverse('job-detail', kwargs={'slug': self.job.slug}))

        self.assertEqual(response.status_code, 200)
        self.job.refresh_from_db()
        self.assertEqual(self.job.view_count, 0)

    def test_tracking_requires_analytics_consent_and_does_not_set_viewer_cookie(self):
        response = self.client.post(reverse('job-view-create', kwargs={'slug': self.job.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['reason'], 'consent_required')
        self.assertNotIn('procv_viewer_id', response.cookies)
        self.job.refresh_from_db()
        self.assertEqual(self.job.view_count, 0)

    @patch('apps.jobs.services.engagement._claim_first_view', return_value=True)
    def test_first_consented_view_increments_once_and_sets_viewer_cookie(self, _claim_first_view):
        self.client.post(
            reverse('privacy-consent'),
            {'preferences': False, 'analytics': True, 'marketing': False},
            format='json',
        )

        response = self.client.post(reverse('job-view-create', kwargs={'slug': self.job.slug}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'counted': True, 'view_count': 1})
        self.assertIn('procv_viewer_id', response.cookies)
        self.job.refresh_from_db()
        self.assertEqual(self.job.view_count, 1)

class JobSalaryBucketFilterTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(company_name='Acme', created_by=self.user)

    def create_job(self, title, salary_min, salary_max):
        return Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title=title,
            description='Description',
            salary_min=salary_min,
            salary_max=salary_max,
            salary_type=Job.SalaryType.RANGE,
            status=Job.Status.ACTIVE,
        )

    def test_homepage_under_10_bucket_uses_displayed_upper_salary(self):
        self.create_job('Under 10', 5_000_000, 9_000_000)
        self.create_job('Crosses 10', 8_000_000, 13_000_000)
        self.create_job('Starts at 10', 10_000_000, 25_000_000)

        response = self.client.get(reverse('job-list'), {'salary_bucket': 'u10'})

        self.assertEqual(response.status_code, 200)
        titles = {job['title'] for job in response.data['results']}
        self.assertEqual(titles, {'Under 10'})

    def test_list_contract_contains_card_fields_only(self):
        self.create_job('Contract job', 10_000_000, 15_000_000)

        response = self.client.get(reverse('job-list'))

        self.assertEqual(response.status_code, 200)
        item = next(job for job in response.data['results'] if job['title'] == 'Contract job')
        self.assertEqual(set(item), {
            'public_id', 'slug', 'title', 'company_name', 'company_logo_url',
            'brand_slug', 'company_verified', 'category', 'locations_detail',
            'job_skills', 'work_type', 'employment_type', 'education_level',
            'experience_years', 'position_level', 'age_min', 'age_max',
            'salary_type', 'salary_min', 'salary_max', 'currency', 'tier',
            'is_hot', 'is_urgent', 'has_flash_badge', 'published_at', 'created_at',
        })
        self.assertTrue({
            'description', 'requirements', 'benefits', 'application_contact',
            'application_count', 'status', 'updated_at',
        }.isdisjoint(item))


class EmployerJobSerializerTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='employer-write@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(company_name='Acme', created_by=self.user)
        self.province = Location.objects.create(
            code='01-test', level=Location.Level.PROVINCE, name='Thành phố Hà Nội',
        )
        self.ward = Location.objects.create(
            code='00001-test', level=Location.Level.WARD, name='Phường Cầu Giấy',
            parent=self.province,
        )
        self.specialization = JobCategory.objects.create(
            name='Chăm sóc khách hàng',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.domain = JobCategory.objects.create(
            name='Giáo dục / Đào tạo',
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        self.skill_group = SkillGroup.objects.create(name='Chăm sóc khách hàng')
        self.skill = Skill.objects.create(name='Giao tiếp', group=self.skill_group)
        self.benefit = Benefit.objects.get(name='Bảo hiểm xã hội')
        self.language = Language.objects.get(code='ko')

    def test_employer_list_uses_compact_management_contract(self):
        Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title='Tin quản lý',
            description='Nội dung dài không thuộc response danh sách',
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse('employer-job-list-create'))

        self.assertEqual(response.status_code, 200)
        item = response.data['results'][0]
        self.assertEqual(set(item), {
            'public_id', 'title', 'company_name', 'locations_detail',
            'employment_type', 'deadline', 'status', 'application_count',
            'published_at', 'created_at', 'updated_at',
        })
        self.assertTrue({
            'description', 'requirements', 'benefits', 'application_contact',
            'job_skills', 'category_assignments',
        }.isdisjoint(item))

    def payload(self):
        return {
            'title': 'Nhân viên chăm sóc khách hàng',
            'description': '<p>Tư vấn và hỗ trợ học viên.</p>',
            'requirements': '<p>Giao tiếp tốt.</p>',
            'benefits': '<p>Đầy đủ chế độ.</p>',
            'work_type': Job.WorkType.ONSITE,
            'employment_type': Job.EmploymentType.FULL_TIME,
            'experience_years': Job.ExperienceYears.UNDER_1,
            'position_level': Job.PositionLevel.EMPLOYEE,
            'education_level': Job.EducationLevel.UNIVERSITY,
            'gender_requirement': Job.GenderRequirement.FEMALE,
            'age_min': 22,
            'age_max': 30,
            'number_of_vacancies': 6,
            'salary_type': Job.SalaryType.RANGE,
            'salary_min': '9000000',
            'salary_max': '12000000',
            'currency': 'VND',
            'category_assignments': [
                {'category': self.specialization.pk, 'role': 'primary_specialization'},
                {'category': self.domain.pk, 'role': 'domain_knowledge'},
            ],
            'job_locations': [
                {'location': self.ward.pk, 'address_detail': '55 Cầu Giấy'},
            ],
            'work_schedules': [
                {
                    'weekday_from': 1, 'weekday_to': 5,
                    'start_time': '08:00', 'end_time': '17:00',
                },
            ],
            'job_skills': [
                {'skill': self.skill.pk, 'importance': 'required'},
            ],
            'job_benefits': [
                {'benefit': self.benefit.pk},
            ],
            'language_requirements': [
                {
                    'language': self.language.pk,
                    'proficiency_level': 'conversational',
                    'certificate': 'TOPIK 1',
                },
            ],
            'application_contact': {
                'recipient_name': 'Nguyễn Văn A',
                'phone': '0900000000',
                'emails': [{'email': 'hr@acme.test'}],
            },
        }

    def test_nested_create_persists_complete_job_posting(self):
        serializer = EmployerJobWriteSerializer(data=self.payload())

        self.assertTrue(serializer.is_valid(), serializer.errors)
        job = serializer.save(posted_by=self.user, company=self.company)

        self.assertEqual(job.category_assignments.count(), 2)
        self.assertEqual(job.job_locations.count(), 1)
        self.assertEqual(job.work_schedules.count(), 1)
        self.assertEqual(job.job_skills.count(), 1)
        self.assertEqual(job.job_benefits.count(), 1)
        self.assertEqual(job.language_requirements.count(), 1)
        self.assertEqual(job.application_contact.emails.count(), 1)

    def test_new_job_location_rejects_province_only(self):
        payload = self.payload()
        payload['job_locations'][0]['location'] = self.province.pk
        serializer = EmployerJobWriteSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn('job_locations', serializer.errors)

    def test_contact_rejects_more_than_five_emails(self):
        payload = self.payload()
        payload['application_contact']['emails'] = [
            {'email': f'hr{index}@acme.test'} for index in range(6)
        ]
        serializer = EmployerJobWriteSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn('application_contact', serializer.errors)

    def test_public_detail_does_not_expose_application_contact(self):
        serializer = EmployerJobWriteSerializer(data=self.payload())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        job = serializer.save(posted_by=self.user, company=self.company)

        data = JobDetailSerializer(job).data

        self.assertNotIn('application_contact', data)
        self.assertNotIn('hr@acme.test', str(data))
        self.assertTrue({
            'status', 'application_count', 'tier', 'has_flash_badge',
            'category_assignments', 'job_skills', 'job_benefits', 'updated_at',
        }.isdisjoint(data))

    def test_public_detail_exposes_grouped_view_model(self):
        payload = self.payload()
        ward2 = Location.objects.create(
            code='00002-test', level=Location.Level.WARD, name='Phường Dịch Vọng',
            parent=self.province,
        )
        province2 = Location.objects.create(
            code='02-test', level=Location.Level.PROVINCE, name='Thành phố Đà Nẵng',
        )
        ward3 = Location.objects.create(
            code='00003-test', level=Location.Level.WARD, name='Phường Hải Châu',
            parent=province2,
        )
        payload['job_locations'] += [
            {'location': ward2.pk, 'address_detail': '12 Dịch Vọng'},
            {'location': ward3.pk, 'address_detail': '3 Hải Châu'},
        ]
        serializer = EmployerJobWriteSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        job = serializer.save(posted_by=self.user, company=self.company)

        data = JobDetailSerializer(job).data

        self.assertEqual(data['primary_specialization'], {
            'id': self.specialization.pk,
            'name': 'Chăm sóc khách hàng',
            'slug': self.specialization.slug,
        })
        self.assertEqual(
            [item['name'] for item in data['domain_knowledge']],
            ['Giáo dục / Đào tạo'],
        )

        self.assertEqual(len(data['workplace_groups']), 2)
        hanoi = next(g for g in data['workplace_groups'] if g['province_name'] == 'Thành phố Hà Nội')
        self.assertEqual(
            [address['display'] for address in hanoi['addresses']],
            ['55 Cầu Giấy, Phường Cầu Giấy', '12 Dịch Vọng, Phường Dịch Vọng'],
        )
        danang = next(g for g in data['workplace_groups'] if g['province_name'] == 'Thành phố Đà Nẵng')
        self.assertEqual(danang['addresses'][0]['display'], '3 Hải Châu, Phường Hải Châu')

        self.assertEqual(data['requirement_tags'], [
            'Dưới 1 năm kinh nghiệm',
            'Tuổi 22 - 30',
            'Từ Đại học trở lên',
            'Giới tính: Nữ',
            'Giao tiếp',
        ])
        self.assertEqual(data['benefit_tags'], ['Bảo hiểm xã hội'])

        language = data['language_requirements'][0]
        self.assertEqual(language['language_name'], 'Tiếng Hàn')
        self.assertEqual(language['proficiency_label'], 'Giao tiếp')
        self.assertEqual(language['certificate'], 'TOPIK 1')

    def test_public_detail_view_model_handles_minimal_job(self):
        job = Job.objects.create(
            posted_by=self.user,
            company=self.company,
            title='Tuyển gấp nhân viên',
            description='Mô tả',
            status=Job.Status.ACTIVE,
        )

        data = JobDetailSerializer(job).data

        self.assertIsNone(data['primary_specialization'])
        self.assertEqual(data['domain_knowledge'], [])
        self.assertEqual(data['workplace_groups'], [])
        self.assertEqual(data['requirement_tags'], [])
        self.assertEqual(data['benefit_tags'], [])

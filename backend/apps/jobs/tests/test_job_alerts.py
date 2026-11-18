"""Job alert API, cadence and strict matching."""

from datetime import datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.db import connection
from django.test import SimpleTestCase, TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import path, reverse
from django.utils import timezone
from drf_spectacular.generators import SchemaGenerator
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.candidates.models import (
    CandidateConsent,
)
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.locations.models import Location

from ..api.serializers.alerts import JobAlertCreateSerializer
from ..api.views.alerts import CandidateJobAlertListCreateView
from ..models import (
    Job,
    JobAlert,
    JobCategory,
    JobCategoryAssignment,
)
from ..selectors.alerts import strict_job_alert_matches
from ..services import (
    create_job_alert,
    next_job_alert_run,
)
from .factories import open_visibility_window


class JobAlertContractSchemaTests(SimpleTestCase):
    def test_read_shapes_and_post_state_are_exact_in_openapi(self):
        schema = SchemaGenerator(
            patterns=[
                path(
                    'api/jobs/alerts/',
                    CandidateJobAlertListCreateView.as_view(),
                    name='candidate-job-alert-list-schema-test',
                )
            ]
        ).get_schema(request=None, public=True)
        components = schema['components']['schemas']
        read_properties = components['JobAlertRead']['properties']

        self.assertEqual(read_properties['category_ids']['type'], 'array')
        self.assertEqual(read_properties['category_ids']['items']['type'], 'integer')
        self.assertEqual(read_properties['categories']['type'], 'array')
        self.assertIn('$ref', read_properties['categories']['items'])
        for field in ('province', 'ward'):
            self.assertNotEqual(read_properties[field].get('type'), 'string')
            self.assertIn('$ref', read_properties[field]['allOf'][0])
        self.assertNotIn('is_active', components['JobAlertCreateRequest']['properties'])


class JobAlertCadenceTests(SimpleTestCase):
    timezone = ZoneInfo('Asia/Ho_Chi_Minh')

    def _next_local(self, value, frequency):
        return next_job_alert_run(value, frequency).astimezone(self.timezone)

    def test_daily_uses_next_exact_0800_vietnam_boundary(self):
        before = datetime(2026, 8, 11, 7, 59, tzinfo=self.timezone)
        at_boundary = datetime(2026, 8, 11, 8, 0, tzinfo=self.timezone)

        self.assertEqual(
            self._next_local(before, JobAlert.Frequency.DAILY),
            datetime(2026, 8, 11, 8, 0, tzinfo=self.timezone),
        )
        self.assertEqual(
            self._next_local(at_boundary, JobAlert.Frequency.DAILY),
            datetime(2026, 8, 12, 8, 0, tzinfo=self.timezone),
        )

    def test_weekly_uses_next_monday_0800_vietnam_boundary(self):
        sunday = datetime(2026, 8, 9, 12, 0, tzinfo=self.timezone)
        monday_before = datetime(2026, 8, 10, 7, 59, tzinfo=self.timezone)
        monday_boundary = datetime(2026, 8, 10, 8, 0, tzinfo=self.timezone)

        expected_monday = datetime(2026, 8, 10, 8, 0, tzinfo=self.timezone)
        self.assertEqual(
            self._next_local(sunday, JobAlert.Frequency.WEEKLY),
            expected_monday,
        )
        self.assertEqual(
            self._next_local(monday_before, JobAlert.Frequency.WEEKLY),
            expected_monday,
        )
        self.assertEqual(
            self._next_local(monday_boundary, JobAlert.Frequency.WEEKLY),
            datetime(2026, 8, 17, 8, 0, tzinfo=self.timezone),
        )


class CandidateJobAlertApiTests(APITestCase):
    def setUp(self):
        self.candidate = User.objects.create_user(
            email='job-alerts@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
        )
        self.other_candidate = User.objects.create_user(
            email='other-job-alerts@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
        )
        self.root_category = JobCategory.objects.create(
            name='Công nghệ thông tin',
            category_type=JobCategory.CategoryType.OCCUPATION_GROUP,
        )
        self.backend_category = JobCategory.objects.create(
            name='Backend',
            parent=self.root_category,
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        self.frontend_category = JobCategory.objects.create(
            name='Frontend',
            parent=self.root_category,
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        self.client.force_authenticate(self.candidate)
        self.list_url = reverse('candidate-job-alert-list')

    def _post(self, keyword='Python', **overrides):
        payload = {
            'keyword': keyword,
            'keyword_scope': JobAlert.KeywordScope.TITLE,
            'category_ids': [],
            'province_id': None,
            'ward_id': None,
            'salary_bucket': None,
            'experience_years': None,
            'work_type': None,
            'employment_type': None,
            'frequency': JobAlert.Frequency.DAILY,
        }
        payload.update(overrides)
        return self.client.post(self.list_url, payload, format='json')

    def test_minimal_nullable_payload_creates_and_list_uses_stable_envelope(self):
        response = self._post(category_ids=[self.backend_category.pk])

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['category_ids'], [self.backend_category.pk])
        self.assertEqual(
            response.data['categories'],
            [
                {
                    'id': self.backend_category.pk,
                    'name': self.backend_category.name,
                    'category_type': self.backend_category.category_type,
                }
            ],
        )
        for field in ('salary_bucket', 'experience_years', 'work_type', 'employment_type'):
            self.assertIsNone(response.data[field])

        list_response = self.client.get(self.list_url)
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(set(list_response.data), {'results', 'limit', 'remaining'})
        self.assertEqual(list_response.data['limit'], 5)
        self.assertEqual(list_response.data['remaining'], 4)
        self.assertEqual(len(list_response.data['results']), 1)

    def test_unverified_candidate_can_view_but_cannot_create_or_enable(self):
        alert = create_job_alert(self.candidate, {'keyword': 'Data'})
        alert.is_active = False
        alert.save(update_fields=['is_active', 'updated_at'])
        self.candidate.email_verified = False
        self.candidate.save(update_fields=['email_verified', 'updated_at'])

        self.assertEqual(self.client.get(self.list_url).status_code, 200)
        create_response = self._post('DevOps')
        self.assertEqual(create_response.status_code, 400)
        self.assertEqual(create_response.data['code'], 'email_unverified')

        detail_url = reverse('candidate-job-alert-detail', kwargs={'public_id': alert.public_id})
        enable_response = self.client.patch(detail_url, {'is_active': True}, format='json')
        self.assertEqual(enable_response.status_code, 400)
        self.assertEqual(enable_response.data['code'], 'email_unverified')

    def test_post_rejects_state_and_category_validation_is_strict(self):
        self.assertNotIn('is_active', JobAlertCreateSerializer().fields)
        state_response = self._post(is_active=False)
        self.assertEqual(state_response.status_code, 400)
        self.assertIn('is_active', state_response.data)

        duplicate_category_response = self._post(
            category_ids=[self.backend_category.pk, self.backend_category.pk]
        )
        self.assertEqual(duplicate_category_response.status_code, 400)
        self.assertIn('category_ids', duplicate_category_response.data)

        inactive = JobCategory.objects.create(
            name='Ngừng hoạt động',
            status=JobCategory.Status.INACTIVE,
        )
        inactive_response = self._post(category_ids=[inactive.pk])
        self.assertEqual(inactive_response.status_code, 400)
        self.assertIn('category_ids', inactive_response.data)

    def test_duplicate_fingerprint_uses_expanded_leaf_coverage(self):
        first = self._post(category_ids=[self.root_category.pk])
        self.assertEqual(first.status_code, 201, first.data)
        newly_added_leaf = JobCategory.objects.create(
            name='Mobile',
            parent=self.root_category,
            category_type=JobCategory.CategoryType.DOMAIN,
        )

        equivalent = self._post(
            category_ids=[
                self.backend_category.pk,
                self.frontend_category.pk,
                newly_added_leaf.pk,
            ]
        )
        self.assertEqual(equivalent.status_code, 400)
        self.assertEqual(equivalent.data['code'], 'duplicate_alert')

        redundant = self._post(
            keyword='Java',
            category_ids=[self.root_category.pk, self.backend_category.pk],
        )
        self.assertEqual(redundant.status_code, 201, redundant.data)
        equivalent_redundant = self._post(
            keyword='Java',
            category_ids=[
                self.backend_category.pk,
                self.frontend_category.pk,
                newly_added_leaf.pk,
            ],
        )
        self.assertEqual(equivalent_redundant.status_code, 400)
        self.assertEqual(equivalent_redundant.data['code'], 'duplicate_alert')

        accented = self._post(keyword='Kỹ sư dữ liệu')
        self.assertEqual(accented.status_code, 201, accented.data)
        folded = self._post(keyword='Ky su du lieu')
        self.assertEqual(folded.status_code, 400)
        self.assertEqual(folded.data['code'], 'duplicate_alert')

        frequency_only = self._post(
            keyword='Kỹ sư dữ liệu',
            frequency=JobAlert.Frequency.WEEKLY,
        )
        self.assertEqual(frequency_only.status_code, 400)
        self.assertEqual(frequency_only.data['code'], 'duplicate_alert')

    def test_list_query_count_is_flat_with_multiple_alerts_and_categories(self):
        first = self._post(category_ids=[self.backend_category.pk])
        self.assertEqual(first.status_code, 201, first.data)
        with CaptureQueriesContext(connection) as one_alert_queries:
            one_response = self.client.get(self.list_url)
        self.assertEqual(one_response.status_code, 200)

        for index in range(1, 5):
            response = self._post(
                keyword=f'Query budget {index}',
                category_ids=[self.backend_category.pk, self.frontend_category.pk],
            )
            self.assertEqual(response.status_code, 201, response.data)
        with CaptureQueriesContext(connection) as five_alert_queries:
            five_response = self.client.get(self.list_url)

        self.assertEqual(five_response.status_code, 200)
        self.assertEqual(len(five_response.data['results']), 5)
        self.assertEqual(len(five_alert_queries), len(one_alert_queries))
        self.assertLessEqual(len(five_alert_queries), 3)

    def test_limit_and_foreign_detail_use_stable_contract(self):
        for index in range(5):
            response = self._post(keyword=f'Alert {index}')
            self.assertEqual(response.status_code, 201, response.data)
        limit_response = self._post(keyword='Alert 6')
        self.assertEqual(limit_response.status_code, 400)
        self.assertEqual(limit_response.data['code'], 'alert_limit_reached')

        foreign = create_job_alert(self.other_candidate, {'keyword': 'Private'})
        foreign_url = reverse('candidate-job-alert-detail', kwargs={'public_id': foreign.public_id})
        self.assertEqual(self.client.get(foreign_url).status_code, 404)
        self.assertEqual(
            self.client.patch(foreign_url, {'is_active': False}, format='json').status_code,
            404,
        )
        self.assertEqual(self.client.delete(foreign_url).status_code, 404)

    def test_patch_clears_nullable_values_and_replayed_state_does_not_move_cursor(self):
        response = self._post(
            work_type=Job.WorkType.REMOTE,
            category_ids=[self.backend_category.pk],
        )
        detail_url = reverse(
            'candidate-job-alert-detail', kwargs={'public_id': response.data['public_id']}
        )
        alert = JobAlert.objects.get(public_id=response.data['public_id'])
        original_cursor = alert.cursor_at

        replay = self.client.patch(detail_url, {'is_active': True}, format='json')
        self.assertEqual(replay.status_code, 200, replay.data)
        alert.refresh_from_db()
        self.assertEqual(alert.cursor_at, original_cursor)

        cleared = self.client.patch(
            detail_url,
            {'work_type': None, 'category_ids': []},
            format='json',
        )
        self.assertEqual(cleared.status_code, 200, cleared.data)
        self.assertIsNone(cleared.data['work_type'])
        self.assertEqual(cleared.data['category_ids'], [])
        alert.refresh_from_db()
        self.assertGreater(alert.cursor_at, original_cursor)

    def test_frequency_patch_reschedules_without_skipping_matching_window(self):
        response = self._post(keyword='Cadence')
        detail_url = reverse(
            'candidate-job-alert-detail', kwargs={'public_id': response.data['public_id']}
        )
        alert = JobAlert.objects.get(public_id=response.data['public_id'])
        original_cursor = alert.cursor_at
        change_time = timezone.now() + timedelta(hours=1)

        with patch('apps.jobs.services.alerts.timezone.now', return_value=change_time):
            changed = self.client.patch(
                detail_url,
                {'frequency': JobAlert.Frequency.WEEKLY},
                format='json',
            )

        self.assertEqual(changed.status_code, 200, changed.data)
        alert.refresh_from_db()
        self.assertEqual(alert.cursor_at, original_cursor)
        self.assertGreater(alert.next_run_at, change_time)

    def test_ward_must_belong_to_selected_province(self):
        province = Location.objects.create(
            code='job-alert-province',
            name='Hà Nội',
            level=Location.Level.PROVINCE,
        )
        other_province = Location.objects.create(
            code='job-alert-province-2',
            name='Đà Nẵng',
            level=Location.Level.PROVINCE,
        )
        ward = Location.objects.create(
            code='job-alert-ward',
            name='Phường Hải Châu',
            level=Location.Level.WARD,
            parent=other_province,
        )

        response = self._post(province_id=province.pk, ward_id=ward.pk)

        self.assertEqual(response.status_code, 400)
        self.assertIn('ward_id', response.data)


class StrictJobAlertSelectorTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.candidate = User.objects.create_user(
            email='strict-alert@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
        )
        self.employer = User.objects.create_user(
            email='strict-alert-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Strict Alert Co',
            created_by=self.employer,
        )
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
        self.root = JobCategory.objects.create(
            name='Kỹ thuật',
            category_type=JobCategory.CategoryType.OCCUPATION_GROUP,
        )
        self.domain = JobCategory.objects.create(
            name='Phần mềm',
            parent=self.root,
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        self.leaf = JobCategory.objects.create(
            name='Backend Python',
            parent=self.domain,
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.other_root = JobCategory.objects.create(name='Kinh doanh')
        self.alert = create_job_alert(
            self.candidate,
            {
                'keyword': 'Python',
                'categories': [self.root, self.other_root],
                'work_type': Job.WorkType.REMOTE,
            },
        )
        self.alert.cursor_at = self.now - timedelta(hours=2)
        self.alert.save(update_fields=['cursor_at', 'updated_at'])

    def _job(self, title, *, category, work_type=Job.WorkType.REMOTE, **overrides):
        values = {
            'posted_by': self.employer,
            'company': self.company,
            'title': title,
            'description': 'Mô tả.',
            'status': Job.Status.ACTIVE,
            **open_visibility_window(),
            'published_at': self.now - timedelta(minutes=5),
            'work_type': work_type,
        }
        values.update(overrides)
        job = Job.objects.create(
            **values,
        )
        JobCategoryAssignment.objects.create(
            job=job,
            category=category,
            role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
        return job

    def test_categories_are_or_with_descendants_and_other_criteria_remain_and(self):
        matching_descendant = self._job('Python Engineer', category=self.leaf)
        matching_other_selection = self._job('Python Sales', category=self.other_root)
        self._job(
            'Python Onsite',
            category=self.leaf,
            work_type=Job.WorkType.ONSITE,
        )
        unrelated_category = JobCategory.objects.create(name='Pháp lý')
        self._job('Python Legal', category=unrelated_category)
        self._job('Java Engineer', category=self.leaf)

        results = list(
            strict_job_alert_matches(
                self.alert,
                published_before=self.now,
            )
        )

        self.assertEqual(
            {job.pk for job in results},
            {matching_descendant.pk, matching_other_selection.pk},
        )
        self.assertFalse(CandidateConsent.objects.filter(candidate_profile__user=self.candidate))

    def test_salary_bucket_matches_vnd_overlap_and_excludes_usd(self):
        self.alert.salary_bucket = JobAlert.SalaryBucket.UNDER_10
        self.alert.save(update_fields=['salary_bucket', 'updated_at'])
        overlapping_vnd = self._job(
            'Python VND overlap',
            category=self.leaf,
            salary_type=Job.SalaryType.RANGE,
            salary_min=9_000_000,
            salary_max=12_000_000,
            currency=Job.Currency.VND,
        )
        self._job(
            'Python USD numeric overlap',
            category=self.leaf,
            salary_type=Job.SalaryType.RANGE,
            salary_min=5,
            salary_max=8,
            currency=Job.Currency.USD,
        )
        self._job(
            'Python VND outside',
            category=self.leaf,
            salary_type=Job.SalaryType.RANGE,
            salary_min=11_000_000,
            salary_max=15_000_000,
            currency=Job.Currency.VND,
        )

        results = list(strict_job_alert_matches(self.alert, published_before=self.now))

        self.assertEqual([job.pk for job in results], [overlapping_vnd.pk])

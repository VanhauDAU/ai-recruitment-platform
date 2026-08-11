from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

from celery.exceptions import Retry
from django.conf import settings
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
    CandidateEmailNotificationSettings,
    CandidateJobPreference,
)
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.locations.models import Location
from apps.sitecontent.models import SiteSetting
from common.metrics import ALLOWED_METRICS

from ..api.serializers.alerts import JobAlertCreateSerializer
from ..api.views.alerts import CandidateJobAlertListCreateView
from ..models import (
    CandidateJobDigest,
    CandidateJobDigestItem,
    CandidateJobDigestSchedule,
    CandidateJobEmailReceipt,
    CandidateJobEmailSuppression,
    Job,
    JobAlert,
    JobCategory,
    JobCategoryAssignment,
)
from ..selectors.alerts import strict_job_alert_matches
from ..services import (
    create_job_alert,
    deliver_candidate_job_digest,
    next_job_alert_run,
    reset_candidate_job_delivery_cursors,
    update_job_alert,
)
from ..services.digests import (
    PREPARATION_CLAIM_LEASE,
    claim_due_candidate_job_digest_candidates,
    due_candidate_ids,
    prepare_candidate_job_digest,
    purge_candidate_job_digest_history,
)
from ..tasks import deliver_candidate_job_digest as deliver_candidate_job_digest_task
from ..tasks import prepare_candidate_job_digest as prepare_candidate_job_digest_task
from ..tasks import prepare_due_candidate_job_digests as prepare_due_candidate_job_digests_task


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


class CandidateJobDigestDeliveryTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.candidate = User.objects.create_user(
            email='digest-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
            full_name='Ứng viên Digest',
        )
        self.employer = User.objects.create_user(
            email='digest-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Digest Company',
            created_by=self.employer,
        )
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
        SiteSetting.objects.update_or_create(
            key='email_notifications_enabled',
            defaults={
                'label': 'Email notifications',
                'group': SiteSetting.Group.EMAIL,
                'value': True,
                'value_type': SiteSetting.ValueType.BOOLEAN,
            },
        )
        self.alert = create_job_alert(self.candidate, {'keyword': 'Python'})
        self.alert.cursor_at = self.now - timedelta(days=1)
        self.alert.save(update_fields=['cursor_at', 'updated_at'])

    def _job(self, title='Python Engineer'):
        return Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title=title,
            description='Mô tả.',
            status=Job.Status.ACTIVE,
            published_at=self.now - timedelta(minutes=5),
        )

    def _digest(self, job, *, scheduled_for=None):
        scheduled_for = scheduled_for or self.now
        digest = CandidateJobDigest.objects.create(
            candidate=self.candidate,
            scheduled_for=scheduled_for,
            source_alert_public_ids=[self.alert.public_id],
            source_windows={
                'alerts': {self.alert.public_id: (scheduled_for - timedelta(hours=1)).isoformat()},
                'suitable': None,
            },
            recipient_email=self.candidate.email,
            recipient_auth_revision=self.candidate.auth_revision,
            status=CandidateJobDigest.Status.PENDING,
            job_count=1,
        )
        CandidateJobDigestItem.objects.create(
            digest=digest,
            candidate=self.candidate,
            job=job,
            source_kind=CandidateJobDigestItem.SourceKind.CONFIGURED_ALERT,
            source_alert=self.alert,
            source_alert_public_ids=[self.alert.public_id],
            source_alert_fingerprints={
                self.alert.public_id: self.alert.criteria_fingerprint,
            },
            job_published_at=job.published_at,
        )
        return digest

    @patch('apps.jobs.services.digests.send_html_email')
    def test_success_persists_receipt_message_id_and_delayed_digest_is_deduped(self, send):
        job = self._job()
        first = self._digest(job)

        result = deliver_candidate_job_digest(first.pk)

        self.assertEqual(result, CandidateJobDigest.Status.SENT)
        send.assert_called_once()
        self.assertEqual(send.call_args.kwargs['headers'], {'Message-ID': first.message_id})
        self.assertTrue(
            CandidateJobEmailReceipt.objects.filter(
                candidate=self.candidate,
                job=job,
                job_published_at=job.published_at,
            ).exists()
        )
        self.assertTrue(
            CandidateJobEmailSuppression.objects.filter(
                candidate=self.candidate,
                job=job,
            ).exists()
        )

        job.published_at = self.now + timedelta(seconds=30)
        job.save(update_fields=['published_at', 'updated_at'])
        delayed = self._digest(job, scheduled_for=self.now + timedelta(minutes=1))
        second_result = deliver_candidate_job_digest(delayed.pk)
        self.assertEqual(second_result, CandidateJobDigest.Status.CANCELLED)
        self.assertEqual(send.call_count, 1)

        purge_candidate_job_digest_history(self.now + timedelta(days=91))
        self.assertFalse(
            CandidateJobEmailReceipt.objects.filter(candidate=self.candidate, job=job).exists()
        )
        self.assertTrue(
            CandidateJobEmailSuppression.objects.filter(
                candidate=self.candidate,
                job=job,
            ).exists()
        )
        after_retention = self._digest(
            job,
            scheduled_for=self.now + timedelta(days=92),
        )
        third_result = deliver_candidate_job_digest(after_retention.pk)
        self.assertEqual(third_result, CandidateJobDigest.Status.CANCELLED)
        self.assertEqual(send.call_count, 1)

    @patch('apps.jobs.services.digests.send_html_email', side_effect=RuntimeError('SMTP down'))
    def test_failure_retries_four_service_attempts_without_advancing_cursor(self, _send):
        job = self._job('Python Retry')
        previous_cursor = self.now - timedelta(hours=2)
        self.alert.cursor_at = previous_cursor
        self.alert.save(update_fields=['cursor_at', 'updated_at'])
        digest = self._digest(job)
        digest.source_windows = {
            'alerts': {self.alert.public_id: previous_cursor.isoformat()},
            'suitable': None,
        }
        digest.save(update_fields=['source_windows', 'updated_at'])

        for expected_attempt in range(1, 5):
            with self.assertRaisesRegex(RuntimeError, 'SMTP down'):
                deliver_candidate_job_digest(digest.pk)
            digest.refresh_from_db()
            self.assertEqual(digest.attempts, expected_attempt)
            expected_status = (
                CandidateJobDigest.Status.FAILED
                if expected_attempt == 4
                else CandidateJobDigest.Status.PENDING
            )
            self.assertEqual(digest.status, expected_status)

        self.assertFalse(CandidateJobEmailReceipt.objects.filter(candidate=self.candidate))
        self.assertFalse(CandidateJobEmailSuppression.objects.filter(candidate=self.candidate))
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.cursor_at, previous_cursor)

    @patch('apps.jobs.services.digests.send_html_email')
    def test_current_job_must_still_match_alert_immediately_before_send(self, send):
        job = self._job('Python Current Match')
        digest = self._digest(job)
        job.title = 'Java Current Match'
        job.save(update_fields=['title', 'updated_at'])

        result = deliver_candidate_job_digest(digest.pk)

        self.assertEqual(result, CandidateJobDigest.Status.CANCELLED)
        send.assert_not_called()
        self.assertFalse(CandidateJobEmailSuppression.objects.filter(candidate=self.candidate))

    @patch('apps.jobs.services.digests.send_html_email')
    def test_alert_edit_invalidates_items_prepared_with_old_fingerprint(self, send):
        digest = self._digest(self._job('Python Snapshot'))
        update_job_alert(self.candidate, self.alert, {'keyword': 'Java'})

        result = deliver_candidate_job_digest(digest.pk)

        self.assertEqual(result, CandidateJobDigest.Status.CANCELLED)
        send.assert_not_called()

    @patch('apps.jobs.services.digests.send_html_email')
    def test_current_recipient_identity_is_rechecked_before_send(self, send):
        digest = self._digest(self._job('Python Identity'))
        self.candidate.email = 'changed-email@example.com'
        self.candidate.auth_revision += 1
        self.candidate.save(update_fields=['email', 'auth_revision', 'updated_at'])

        result = deliver_candidate_job_digest(digest.pk)

        self.assertEqual(result, CandidateJobDigest.Status.CANCELLED)
        send.assert_not_called()
        self.assertFalse(CandidateJobEmailReceipt.objects.filter(candidate=self.candidate))


class CandidateJobDigestPreparationTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.candidate = User.objects.create_user(
            email='digest-prepare@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
        )
        self.employer = User.objects.create_user(
            email='digest-prepare-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Digest Prepare Company',
            created_by=self.employer,
        )
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
        SiteSetting.objects.update_or_create(
            key='email_notifications_enabled',
            defaults={
                'label': 'Email notifications',
                'group': SiteSetting.Group.EMAIL,
                'value': True,
                'value_type': SiteSetting.ValueType.BOOLEAN,
            },
        )

    def _job(self, title, *, minutes_old=5):
        return Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title=title,
            description='Mô tả.',
            status=Job.Status.ACTIVE,
            published_at=self.now - timedelta(minutes=minutes_old),
        )

    def _due_alert(self, keyword):
        alert = create_job_alert(self.candidate, {'keyword': keyword})
        alert.cursor_at = self.now - timedelta(days=2)
        alert.next_run_at = self.now - timedelta(seconds=1)
        alert.save(update_fields=['cursor_at', 'next_run_at', 'updated_at'])
        return alert

    def _candidate_with_due_alert(self, index):
        candidate = User.objects.create_user(
            email=f'digest-page-{index}@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
        )
        alert = create_job_alert(candidate, {'keyword': f'Page {index}'})
        JobAlert.objects.filter(pk=alert.pk).update(
            cursor_at=self.now - timedelta(days=2),
            next_run_at=self.now - timedelta(seconds=1),
        )
        return candidate

    @patch('apps.jobs.services.digests.MAX_DUE_CANDIDATES', 2)
    def test_claimed_page_advances_to_later_ids_and_stale_leases_are_reclaimed(self):
        first = self.candidate
        self._due_alert('Page first')
        second = self._candidate_with_due_alert(2)
        third = self._candidate_with_due_alert(3)

        first_page = claim_due_candidate_job_digest_candidates(self.now)
        second_page = claim_due_candidate_job_digest_candidates(self.now)

        self.assertEqual(
            [claim['candidate_id'] for claim in first_page],
            [first.pk, second.pk],
        )
        self.assertEqual(
            [claim['candidate_id'] for claim in second_page],
            [third.pk],
        )

        reclaimed = claim_due_candidate_job_digest_candidates(
            self.now + PREPARATION_CLAIM_LEASE + timedelta(seconds=1)
        )
        self.assertEqual(
            [claim['candidate_id'] for claim in reclaimed],
            [first.pk, second.pk],
        )

    def test_opted_out_and_soft_disabled_sources_are_not_scheduler_candidates(self):
        self._due_alert('Opted out')
        profile = self.candidate.candidate_profile
        CandidateEmailNotificationSettings.objects.create(
            candidate_profile=profile,
            configured_job_alerts=False,
            suitable_job_recommendations=True,
        )
        CandidateJobDigestSchedule.objects.create(
            candidate=self.candidate,
            suitable_cursor_at=self.now - timedelta(days=7),
            suitable_next_run_at=self.now - timedelta(seconds=1),
        )

        self.assertNotIn(self.candidate.pk, due_candidate_ids(self.now))
        self.assertEqual(claim_due_candidate_job_digest_candidates(self.now), [])
        self.assertFalse(
            CandidateJobDigestSchedule.objects.filter(candidate=self.candidate).exists()
        )

    @patch('apps.jobs.services.digests.recommend_new_jobs_for_candidate_email')
    def test_consolidates_round_robin_sources_and_cross_flow_dedupes_at_ten(self, recommend):
        alpha_alert = self._due_alert('Alpha')
        beta_alert = self._due_alert('Beta')
        common = self._job('Alpha Beta Common', minutes_old=1)
        for index in range(6):
            self._job(f'Alpha role {index}', minutes_old=10 + index)
            self._job(f'Beta role {index}', minutes_old=20 + index)
        suitable_only = self._job('Gamma suitable', minutes_old=2)

        profile = self.candidate.candidate_profile
        profile.job_preferences_configured = True
        profile.save(update_fields=['job_preferences_configured', 'updated_at'])
        CandidateJobPreference.objects.create(candidate_profile=profile)
        CandidateConsent.objects.create(
            candidate_profile=profile,
            consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
            decision=CandidateConsent.Decision.GRANTED,
        )
        CandidateEmailNotificationSettings.objects.create(
            candidate_profile=profile,
            configured_job_alerts=True,
            suitable_job_recommendations=True,
        )
        CandidateJobDigestSchedule.objects.create(
            candidate=self.candidate,
            suitable_cursor_at=self.now - timedelta(days=7),
            suitable_next_run_at=self.now - timedelta(seconds=1),
        )
        recommend.return_value = {
            'status': 'ready',
            'results': [
                {'job': common, 'match_score': 90, 'match_reasons': ['Khớp hồ sơ']},
                {
                    'job': suitable_only,
                    'match_score': 80,
                    'match_reasons': ['Khớp kỹ năng'],
                },
            ],
        }

        digest = prepare_candidate_job_digest(self.candidate.pk, self.now)

        self.assertEqual(digest.status, CandidateJobDigest.Status.PENDING)
        items = list(digest.items.order_by('sort_order'))
        self.assertEqual(len(items), 10)
        self.assertEqual(len({(item.job_id, item.job_published_at) for item in items}), 10)
        common_item = next(item for item in items if item.job_id == common.pk)
        self.assertEqual(
            set(common_item.source_alert_public_ids),
            {alpha_alert.public_id, beta_alert.public_id},
        )
        self.assertTrue(common_item.includes_suitable_recommendation)
        self.assertIn(suitable_only.pk, {item.job_id for item in items})
        self.assertTrue(
            any(alpha_alert.public_id in item.source_alert_public_ids for item in items)
        )
        self.assertTrue(any(beta_alert.public_id in item.source_alert_public_ids for item in items))
        alpha_alert.refresh_from_db()
        beta_alert.refresh_from_db()
        self.assertEqual(alpha_alert.cursor_at, self.now - timedelta(days=2))
        self.assertEqual(beta_alert.cursor_at, self.now - timedelta(days=2))

        sent_at = self.now + timedelta(minutes=1)
        CandidateJobEmailReceipt.objects.bulk_create(
            [
                CandidateJobEmailReceipt(
                    candidate=self.candidate,
                    job=item.job,
                    job_published_at=item.job_published_at,
                    digest=digest,
                    sent_at=sent_at,
                )
                for item in items
            ]
        )
        CandidateJobEmailSuppression.objects.bulk_create(
            [
                CandidateJobEmailSuppression(
                    candidate=self.candidate,
                    job=item.job,
                    first_sent_at=sent_at,
                )
                for item in items
            ]
        )
        digest.status = CandidateJobDigest.Status.SENT
        digest.sent_at = sent_at
        digest.save(update_fields=['status', 'sent_at', 'updated_at'])
        later = self.now + timedelta(days=1)
        JobAlert.objects.filter(pk__in=[alpha_alert.pk, beta_alert.pk]).update(
            next_run_at=later - timedelta(seconds=1)
        )
        CandidateJobDigestSchedule.objects.filter(candidate=self.candidate).update(
            suitable_next_run_at=later - timedelta(seconds=1)
        )
        recommend.return_value = {'status': 'ready', 'results': []}

        next_digest = prepare_candidate_job_digest(self.candidate.pk, later)
        next_job_ids = set(next_digest.items.values_list('job_id', flat=True))
        self.assertTrue(next_job_ids)
        self.assertTrue(next_job_ids.isdisjoint({item.job_id for item in items}))
        self.assertLessEqual(len(next_job_ids), 10)

    def test_site_off_advances_checkpoint_and_reenable_has_no_backlog(self):
        alert = self._due_alert('Disabled period')
        disabled_period_job = self._job('Disabled period engineer', minutes_old=1)
        SiteSetting.objects.filter(key='email_notifications_enabled').update(value=False)

        with patch('apps.jobs.services.digests._strict_source_queue') as source_queue:
            claims = claim_due_candidate_job_digest_candidates(self.now)
            source_queue.assert_not_called()

        self.assertEqual(claims, [])
        self.assertFalse(CandidateJobDigest.objects.filter(candidate=self.candidate).exists())
        alert.refresh_from_db()
        self.assertEqual(alert.cursor_at, self.now)
        self.assertGreater(alert.next_run_at, self.now)

        SiteSetting.objects.filter(key='email_notifications_enabled').update(value=True)
        later = self.now + timedelta(days=1)
        JobAlert.objects.filter(pk=alert.pk).update(next_run_at=later - timedelta(seconds=1))
        resumed = prepare_candidate_job_digest(self.candidate.pk, later)

        self.assertEqual(resumed.status, CandidateJobDigest.Status.EMPTY)
        self.assertFalse(resumed.items.filter(job=disabled_period_job).exists())

    def test_paused_alert_is_not_swept_and_resume_excludes_disabled_period(self):
        alert = self._due_alert('Paused period')
        alert.is_active = False
        alert.save(update_fields=['is_active', 'updated_at'])
        disabled_period_job = self._job('Paused period engineer', minutes_old=1)

        skipped = prepare_candidate_job_digest(self.candidate.pk, self.now)
        self.assertIsNone(skipped)
        alert.refresh_from_db()
        self.assertEqual(alert.cursor_at, self.now - timedelta(days=2))

        resume_time = self.now + timedelta(hours=1)
        with patch('apps.jobs.services.alerts.timezone.now', return_value=resume_time):
            update_job_alert(self.candidate, alert, {'is_active': True})
        alert.refresh_from_db()
        self.assertEqual(alert.cursor_at, resume_time)

        later = resume_time + timedelta(days=1)
        JobAlert.objects.filter(pk=alert.pk).update(next_run_at=later - timedelta(seconds=1))
        resumed = prepare_candidate_job_digest(self.candidate.pk, later)
        self.assertEqual(resumed.status, CandidateJobDigest.Status.EMPTY)
        self.assertFalse(resumed.items.filter(job=disabled_period_job).exists())

    def test_configured_master_resume_resets_all_alert_cursors(self):
        first = self._due_alert('Master A')
        second = self._due_alert('Master B')
        resume_time = self.now + timedelta(hours=2)

        with patch('apps.jobs.services.alerts.timezone.now', return_value=resume_time):
            reset_candidate_job_delivery_cursors(self.candidate, configured=True)

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.cursor_at, resume_time)
        self.assertEqual(second.cursor_at, resume_time)
        self.assertGreater(first.next_run_at, resume_time)
        self.assertGreater(second.next_run_at, resume_time)

    def test_eligible_empty_window_keeps_cursor_and_drains_late_visible_job(self):
        alert = self._due_alert('Late visible')
        original_cursor = alert.cursor_at

        empty = prepare_candidate_job_digest(self.candidate.pk, self.now)

        self.assertEqual(empty.status, CandidateJobDigest.Status.EMPTY)
        alert.refresh_from_db()
        self.assertEqual(alert.cursor_at, original_cursor)

        late_visible = self._job('Late visible engineer', minutes_old=1)
        later = self.now + timedelta(days=1)
        JobAlert.objects.filter(pk=alert.pk).update(next_run_at=later - timedelta(seconds=1))
        drained = prepare_candidate_job_digest(self.candidate.pk, later)

        self.assertEqual(drained.status, CandidateJobDigest.Status.PENDING)
        self.assertTrue(drained.items.filter(job=late_visible).exists())


class CandidateJobAlertTaskContractTests(SimpleTestCase):
    @patch('apps.jobs.tasks.alerts.deliver_digest_service', side_effect=RuntimeError('SMTP'))
    def test_delivery_task_passes_exception_to_celery_retry(self, _service):
        with patch.object(
            deliver_candidate_job_digest_task,
            'retry',
            side_effect=Retry(),
        ) as retry:
            with self.assertRaises(Retry):
                deliver_candidate_job_digest_task.run(123)

        self.assertIsInstance(retry.call_args.kwargs['exc'], RuntimeError)
        self.assertEqual(retry.call_args.kwargs['countdown'], 2)

    def test_beat_route_and_worker_consume_candidate_email_queue(self):
        self.assertIn('candidate_job_digest', ALLOWED_METRICS)
        beat_tasks = {entry['task'] for entry in settings.CELERY_BEAT_SCHEDULE.values()}
        self.assertIn('apps.jobs.tasks.prepare_due_candidate_job_digests', beat_tasks)
        self.assertIn('apps.jobs.tasks.dispatch_pending_candidate_job_digests', beat_tasks)
        self.assertIn('apps.jobs.tasks.purge_candidate_job_digest_history', beat_tasks)
        self.assertEqual(
            settings.CELERY_TASK_ROUTES['apps.jobs.tasks.*']['queue'],
            'candidate-email',
        )
        compose = (Path(settings.BASE_DIR).parent / 'docker-compose.yml').read_text()
        self.assertIn('upload-scan,candidate-email', compose)

    @patch('apps.jobs.tasks.alerts.prepare_candidate_job_digest.delay')
    @patch(
        'apps.jobs.tasks.alerts.claim_due_candidates_service',
        return_value=[
            {'candidate_id': 11, 'claimed_at': '2026-08-11T01:00:00+00:00'},
            {'candidate_id': 12, 'claimed_at': '2026-08-11T01:00:00+00:00'},
        ],
    )
    def test_beat_fans_out_bounded_candidate_preparation(self, _claims, prepare_delay):
        result = prepare_due_candidate_job_digests_task.run()

        self.assertEqual(result, 2)
        self.assertEqual(
            [call.args for call in prepare_delay.call_args_list],
            [
                (11, '2026-08-11T01:00:00+00:00'),
                (12, '2026-08-11T01:00:00+00:00'),
            ],
        )
        self.assertEqual(
            prepare_candidate_job_digest_task.name,
            'apps.jobs.tasks.prepare_candidate_job_digest',
        )

    @patch('apps.jobs.tasks.alerts.release_candidate_job_digest_claim')
    @patch(
        'apps.jobs.tasks.alerts.prepare_candidate_job_digest.delay',
        side_effect=RuntimeError('broker unavailable'),
    )
    @patch(
        'apps.jobs.tasks.alerts.claim_due_candidates_service',
        return_value=[{'candidate_id': 11, 'claimed_at': '2026-08-11T01:00:00+00:00'}],
    )
    def test_beat_releases_claim_when_prepare_publish_fails(
        self,
        _claims,
        _prepare_delay,
        release_claim,
    ):
        result = prepare_due_candidate_job_digests_task.run()

        self.assertEqual(result, 1)
        release_claim.assert_called_once_with(11, '2026-08-11T01:00:00+00:00')


class CandidateJobDigestRetentionTests(TestCase):
    def test_retention_removes_old_terminal_history_but_keeps_pending(self):
        now = timezone.now()
        candidate = User.objects.create_user(
            email='digest-retention@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        terminal = CandidateJobDigest.objects.create(
            candidate=candidate,
            scheduled_for=now - timedelta(days=100),
            recipient_email=candidate.email,
            recipient_auth_revision=candidate.auth_revision,
            status=CandidateJobDigest.Status.SENT,
        )
        pending = CandidateJobDigest.objects.create(
            candidate=candidate,
            scheduled_for=now - timedelta(days=101),
            recipient_email=candidate.email,
            recipient_auth_revision=candidate.auth_revision,
            status=CandidateJobDigest.Status.PENDING,
        )
        CandidateJobDigest.objects.filter(pk__in=[terminal.pk, pending.pk]).update(
            created_at=now - timedelta(days=100)
        )

        result = purge_candidate_job_digest_history(now)

        self.assertGreaterEqual(result['digests'], 1)
        self.assertFalse(CandidateJobDigest.objects.filter(pk=terminal.pk).exists())
        self.assertTrue(CandidateJobDigest.objects.filter(pk=pending.pk).exists())

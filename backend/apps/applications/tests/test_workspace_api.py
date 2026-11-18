"""Recruiter workspace API: decisions, undo, history notices, CV export, access audit."""

import shutil
import tempfile
from datetime import timedelta
from hashlib import sha256
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.services import issue_tokens
from apps.candidates.models import CandidateNotification
from apps.candidates.services import release_due_candidate_notifications
from apps.cv_templates.tests.factories import fill_cv_for_application, make_published_template
from apps.cvs.models import CvAccessLog, CvExport, UserCv
from apps.cvs.services import create_application_snapshot, create_user_cv, save_draft_as_version
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.jobs.models import Job
from apps.jobs.tests.factories import open_visibility_window

from ..models import Application

MEDIA_ROOT = tempfile.mkdtemp()
Status = Application.Status


@override_settings(
    MEDIA_ROOT=MEDIA_ROOT,
    CANDIDATE_STATUS_NOTIFICATION_DELAY=timedelta(minutes=5),
)
class RecruiterWorkspaceApiTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        users = get_user_model().objects
        self.candidate = users.create_user(
            email='workspace-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
            full_name='Workspace Candidate',
        )
        self.employer = users.create_user(
            email='workspace-employer@example.com', password='password', role='employer'
        )
        self.outsider = users.create_user(
            email='workspace-outsider@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Workspace Co', created_by=self.employer)
        make_employer_ready(self.employer, company=company, candidate_data=True)
        other_company = Company.objects.create(company_name='Other Co', created_by=self.outsider)
        make_employer_ready(self.outsider, company=other_company, candidate_data=True)
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=company,
            title='Backend Engineer',
            description='Workspace API tests.',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        template, _version = make_published_template('Workspace template')
        self.cv = create_user_cv(actor=self.candidate, title='Workspace CV', template=template)
        fill_cv_for_application(self.cv, self.candidate)
        snapshot = create_application_snapshot(self.cv, self.candidate)
        self.application = Application.objects.create(
            candidate=self.candidate,
            job=self.job,
            cv=self.cv,
            submitted_cv_version=snapshot,
            submitted_cv_title=self.cv.title,
            submitted_cv_source=self.cv.source,
        )
        self.application.status_history.create(from_status='', to_status=Status.SUBMITTED)
        self.login(self.employer)

    def login(self, user):
        tokens = issue_tokens(user, auth_method='password')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

    def url(self, name, *args):
        return reverse(name, args=[self.application.public_id, *args])

    def decide(self, status):
        return self.client.post(
            self.url('recruiter-application-decision'), {'status': status}, format='json'
        )

    def test_list_exposes_only_legal_decisions(self):
        response = self.client.get(reverse('recruiter-application-list'))

        self.assertEqual(response.status_code, 200, response.data)
        row = response.data['results'][0]
        self.assertEqual(row['available_decisions'], list(Application.DECISION_STATUSES))
        self.assertEqual(row['status'], Status.SUBMITTED)

    def test_decision_schedules_notice_and_history_offers_undo(self):
        response = self.decide(Status.SHORTLISTED)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['application']['status'], Status.SHORTLISTED)
        self.assertIsNotNone(response.data['candidate_notice_at'])
        history = self.client.get(self.url('recruiter-application-history')).data['results']
        latest = history[-1]
        self.assertEqual(latest['candidate_notice']['state'], 'scheduled')
        self.assertTrue(latest['can_undo'])
        self.assertIsNone(history[0]['candidate_notice'])

    def test_viewed_cannot_be_chosen_and_terminal_is_final(self):
        self.assertEqual(self.decide(Status.VIEWED).status_code, 400)
        self.assertEqual(self.decide(Status.ACCEPTED).status_code, 200)
        response = self.decide(Status.REJECTED)
        self.assertEqual(response.status_code, 400)
        self.assertIn('status', response.data)

    def test_undo_reverts_until_the_candidate_is_told(self):
        self.decide(Status.REJECTED)

        undone = self.client.post(self.url('recruiter-application-decision-undo'))
        self.assertEqual(undone.status_code, 200, undone.data)
        self.assertEqual(undone.data['status'], Status.SUBMITTED)
        history = self.client.get(self.url('recruiter-application-history')).data['results']
        self.assertEqual(history[-1]['candidate_notice']['state'], 'undone')
        self.assertIsNotNone(history[-1]['reverted_at'])

        self.decide(Status.REJECTED)
        release_due_candidate_notifications(now=timezone.now() + timedelta(minutes=6))
        refused = self.client.post(self.url('recruiter-application-decision-undo'))
        self.assertEqual(refused.status_code, 409)
        self.assertEqual(refused.data['code'], 'STATUS_UNDO_UNAVAILABLE')

    def test_assessment_patch_ignores_status(self):
        response = self.client.patch(
            self.url('recruiter-application-assessment'),
            {'employer_note': 'Strong SQL', 'employer_rating': 5, 'status': Status.ACCEPTED},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['employer_rating'], 5)
        self.assertEqual(response.data['status'], Status.SUBMITTED)

    def test_candidate_sees_a_decision_only_after_it_is_delivered(self):
        self.decide(Status.INTERVIEWED)
        self.login(self.candidate)

        before = self.client.get(reverse('candidate-application-list-create')).data['results']
        self.assertEqual(before[0]['status'], Status.SUBMITTED)
        self.assertEqual([item['status'] for item in before[0]['timeline']], [Status.SUBMITTED])

        release_due_candidate_notifications(now=timezone.now() + timedelta(minutes=6))
        after = self.client.get(reverse('candidate-application-list-create')).data['results']
        self.assertEqual(after[0]['status'], Status.INTERVIEWED)
        self.assertEqual(after[0]['candidate_status'], 'Mời phỏng vấn')

    def test_snapshot_read_is_audited_and_marks_viewed(self):
        response = self.client.get(self.url('recruiter-application-snapshot'))

        self.assertEqual(response.status_code, 200, response.data)
        log = CvAccessLog.objects.get()
        self.assertEqual(
            (log.cv_id, log.actor_type, log.access_channel),
            (None, CvAccessLog.ActorType.RECRUITER, CvAccessLog.AccessChannel.APPLICATION),
        )
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, Status.VIEWED)

    def test_restricted_candidate_snapshot_still_opens(self):
        self.candidate.status = get_user_model().Status.INACTIVE
        self.candidate.save(update_fields=['status', 'updated_at'])
        Application.objects.filter(pk=self.application.pk).update(status=Status.SHORTLISTED)

        response = self.client.get(self.url('recruiter-application-snapshot'))

        self.assertEqual(response.status_code, 200, response.data)

    def _complete(self, export):
        key = f'private-test/{export.public_id}.pdf'
        default_storage.save(key, ContentFile(b'%PDF-1.4 snapshot'))
        CvExport.objects.filter(pk=export.pk).update(
            status=CvExport.Status.COMPLETED,
            storage_key=key,
            checksum_sha256=sha256(b'%PDF-1.4 snapshot').hexdigest(),
            completed_at=timezone.now(),
        )

    def test_cv_export_is_reused_audited_and_notifies_candidate_once(self):
        with patch('apps.cvs.services.exports._dispatch_after_commit'):
            created = self.client.post(self.url('recruiter-application-cv-export'))
        self.assertEqual(created.status_code, 201, created.data)
        self.assertIsNone(created.data['download_url'])
        export = CvExport.objects.get(public_id=created.data['public_id'])
        self.assertIsNone(export.cv_id)
        self._complete(export)

        reused = self.client.post(self.url('recruiter-application-cv-export'))
        self.assertEqual(reused.status_code, 200, reused.data)
        self.assertTrue(reused.data['download_url'].endswith('/download/'))
        download_url = self.url('recruiter-application-cv-export-download', export.public_id)
        for _ in range(2):
            download = self.client.get(download_url)
            self.assertEqual(download.status_code, 200)
            self.assertEqual(b''.join(download.streaming_content), b'%PDF-1.4 snapshot')

        self.assertEqual(
            CvAccessLog.objects.filter(access_channel=CvAccessLog.AccessChannel.EXPORT).count(), 2
        )
        self.assertEqual(
            CandidateNotification.objects.filter(
                event_type=CandidateNotification.EventType.APPLICATION_CV_DOWNLOADED
            ).count(),
            1,
        )

    def test_cv_export_is_private_to_the_job_poster_and_survives_cv_deletion(self):
        with patch('apps.cvs.services.exports._dispatch_after_commit'):
            created = self.client.post(self.url('recruiter-application-cv-export'))
        export = CvExport.objects.get(public_id=created.data['public_id'])
        self._complete(export)

        self.login(self.outsider)
        self.assertEqual(
            self.client.post(self.url('recruiter-application-cv-export')).status_code, 404
        )
        self.assertEqual(
            self.client.get(
                self.url('recruiter-application-cv-export-download', export.public_id)
            ).status_code,
            404,
        )

        UserCv.objects.filter(pk=self.cv.pk).update(is_deleted=True)
        self.login(self.employer)
        detail = self.client.get(
            self.url('recruiter-application-cv-export-detail', export.public_id)
        )
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data['status'], CvExport.Status.COMPLETED)


class CandidateApplyReadinessTests(APITestCase):
    def setUp(self):
        self.candidate = get_user_model().objects.create_user(
            email='ready-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        employer = get_user_model().objects.create_user(
            email='ready-employer@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Ready Co', created_by=employer)
        make_employer_ready(employer, company=company, candidate_data=True)
        self.job = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Ready Job',
            description='Readiness rules.',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        template, _version = make_published_template('Ready template')
        self.cv = create_user_cv(actor=self.candidate, title='Blank CV', template=template)
        tokens = issue_tokens(self.candidate, auth_method='password')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

    def apply(self):
        return self.client.post(
            reverse('candidate-application-list-create'),
            {
                'job_public_id': self.job.public_id,
                'cv_public_id': self.cv.public_id,
                'version_public_id': self.cv.latest_version.public_id,
                'data_processing_consent': True,
            },
            format='json',
        )

    def test_blank_cv_cannot_be_submitted(self):
        # Saved once, still empty: past the never-saved rule, stopped by the content rule.
        save_draft_as_version(
            cv=self.cv, actor=self.candidate, expected_lock_version=self.cv.draft.lock_version
        )
        self.cv.refresh_from_db()

        response = self.apply()

        self.assertEqual(response.status_code, 400)
        self.assertIn('họ tên', str(response.data['cv_public_id']))
        self.assertFalse(Application.objects.exists())

    def test_cv_still_being_parsed_cannot_be_submitted(self):
        fill_cv_for_application(self.cv, self.candidate)
        UserCv.objects.filter(pk=self.cv.pk).update(
            processing_status=UserCv.ProcessingStatus.PROCESSING
        )

        response = self.apply()

        self.assertEqual(response.status_code, 400)
        self.assertIn('đang được phân tích', str(response.data['cv_public_id']))

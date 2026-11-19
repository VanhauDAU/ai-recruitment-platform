"""Applying with an uploaded CV: the recruiter reads the file the candidate sent."""

import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.candidates.models import CandidateNotification
from apps.cv_templates.tests.factories import make_published_template
from apps.cvs.services import create_v2_cv, permanently_delete_cv, upload_cv
from apps.cvs.tests.fixtures import cv_pdf_upload, pdf_bytes
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job
from apps.jobs.tests.helpers import open_visibility_window
from common.storage.r2 import private_media_storage

from ..models import Application

MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA_ROOT, ALLOWED_HOSTS=['testserver'])
class UploadedCvApplicationTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        users = get_user_model().objects
        self.candidate = users.create_user(
            email='upload-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
            full_name='Upload Candidate',
            phone='0909000000',
        )
        self.employer = users.create_user(
            email='upload-employer@example.com', password='password', role='employer'
        )
        self.outsider = users.create_user(
            email='upload-outsider@example.com', password='password', role='employer'
        )
        self.company = Company.objects.create(
            company_name='Upload Company', created_by=self.employer
        )
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Upload Job',
            description='Applications carry the uploaded file.',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        self.cv = upload_cv(self.candidate, cv_pdf_upload('my-cv.pdf'))
        self.client.force_authenticate(self.candidate)

    def apply(self, cv=None, **overrides):
        cv = cv or self.cv
        payload = {
            'job_public_id': self.job.public_id,
            'cv_public_id': cv.public_id,
            'version_public_id': cv.latest_version.public_id,
            'data_processing_consent': True,
            **overrides,
        }
        return self.client.post(
            reverse('candidate-application-list-create-v2'), payload, format='json'
        )

    def cv_file(self, application, **params):
        return self.client.get(
            reverse('recruiter-application-cv-file-v2', args=[application.public_id]), params
        )

    def submitted(self):
        response = self.apply()
        self.assertEqual(response.status_code, 201, response.data)
        return Application.objects.select_related('submitted_cv_version').get(
            public_id=response.data['public_id']
        )

    def listed(self, cv):
        data = self.client.get(reverse('cv-v2-list-create')).data
        rows = data['results'] if isinstance(data, dict) else data
        return next(item for item in rows if item['public_id'] == cv.public_id)

    def test_uploaded_cv_is_ready_and_listed_for_applying(self):
        row = self.listed(self.cv)

        self.assertTrue(row['application_ready'])
        self.assertTrue(row['has_saved_version'])

    def test_recruiter_reads_and_downloads_the_submitted_file(self):
        application = self.submitted()
        snapshot = application.submitted_cv_version
        self.assertTrue(snapshot.source_file_key)
        self.assertNotEqual(snapshot.source_file_key, self.cv.file_url)

        self.client.force_authenticate(self.employer)
        page = self.client.get(
            reverse('recruiter-application-snapshot-v2', args=[application.public_id])
        )
        inline = self.cv_file(application)
        with self.captureOnCommitCallbacks(execute=True):
            download = self.cv_file(application, download='1')

        self.assertTrue(page.data['cv']['has_source_file'])
        self.assertNotIn('source_file_key', page.data['cv'])
        self.assertEqual(inline.status_code, 200)
        self.assertEqual(inline['Content-Type'], 'application/pdf')
        self.assertTrue(inline['Content-Disposition'].startswith('inline'))
        self.assertEqual(b''.join(inline.streaming_content), pdf_bytes())
        self.assertTrue(download['Content-Disposition'].startswith('attachment'))
        self.assertTrue(
            CandidateNotification.objects.filter(
                recipient=self.candidate,
                event_type=CandidateNotification.EventType.APPLICATION_CV_DOWNLOADED,
            ).exists()
        )

        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.cv_file(application).status_code, 404)

    def test_recruiter_keeps_the_file_after_the_candidate_deletes_the_cv(self):
        application = self.submitted()
        with self.captureOnCommitCallbacks(execute=True):
            permanently_delete_cv(cv=self.cv, actor=self.candidate)

        self.client.force_authenticate(self.employer)
        response = self.cv_file(application)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(b''.join(response.streaming_content), pdf_bytes())

    def test_contact_details_are_required_with_an_uploaded_cv(self):
        self.candidate.phone = ''
        self.candidate.save(update_fields=['phone'])

        missing = self.apply()
        filled = self.apply(contact_phone='0911222333')

        self.assertEqual(missing.status_code, 400, missing.data)
        self.assertEqual(set(missing.data), {'contact_phone'})
        self.assertEqual(filled.status_code, 201, filled.data)
        self.assertEqual(filled.data['contact_phone'], '0911222333')

    def test_file_cv_has_no_rendered_export_or_outside_review_link(self):
        application = self.submitted()
        self.client.force_authenticate(self.employer)

        export = self.client.post(
            reverse('recruiter-application-cv-export-v2', args=[application.public_id])
        )
        link = self.client.post(
            reverse('recruiter-application-review-links-v2', args=[application.public_id]),
            {'reviewer_name': 'Trưởng nhóm'},
            format='json',
        )

        self.assertEqual(export.status_code, 400, export.data)
        self.assertEqual(link.status_code, 400, link.data)

    def test_never_saved_builder_cv_cannot_be_submitted(self):
        template, _version = make_published_template('Builder template')
        builder = create_v2_cv(actor=self.candidate, title='Online CV', template=template)

        never_saved = self.apply(cv=builder)

        self.assertFalse(self.listed(builder)['has_saved_version'])
        self.assertEqual(never_saved.status_code, 400, never_saved.data)
        self.assertIn('chưa được lưu', str(never_saved.data['cv_public_id']))

    def test_deleting_a_snapshot_removes_its_copy_of_the_file(self):
        application = self.submitted()
        key = application.submitted_cv_version.source_file_key
        self.assertTrue(private_media_storage().exists(key))

        snapshot = application.submitted_cv_version
        with self.captureOnCommitCallbacks(execute=True):
            application.delete()
            snapshot.delete()

        self.assertFalse(private_media_storage().exists(key))

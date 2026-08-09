import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.uploads.models import UploadSession, UploadState
from apps.uploads.selectors import owned_upload_session
from apps.uploads.tests.helpers import PDF_BYTES, TemporaryUploadStorageMixin, pdf_upload


class UploadSessionApiTests(TemporaryUploadStorageMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.owner = get_user_model().objects.create_user(
            email='upload-api-owner@example.com',
            password='Password@123',
            role='employer',
        )
        self.other = get_user_model().objects.create_user(
            email='upload-api-other@example.com',
            password='Password@123',
            role='employer',
        )
        self.client.force_authenticate(self.owner)

    def create_session(self):
        return self.client.post(
            reverse('uploads:session-create'),
            {
                'purpose': 'employer_verification',
                'original_filename': 'license.pdf',
                'content_type': 'application/pdf',
                'size_bytes': len(PDF_BYTES),
            },
            format='json',
        )

    def test_create_upload_detail_contract_contains_no_internal_evidence(self):
        created = self.create_session()

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['state'], UploadState.UPLOADING)
        serialized = json.dumps(created.data)
        for forbidden in ('storage_key', 'checksum', 'signature', 'scanner', 'owner'):
            self.assertNotIn(forbidden, serialized)

        with self.assertNumQueries(1):
            session = owned_upload_session(
                owner=self.owner,
                public_id=created.data['public_id'],
            )
        self.assertEqual(session.purpose, 'employer_verification')

    @patch('apps.uploads.api.views.sessions.scan_upload_session.delay')
    def test_content_stays_quarantined_until_worker_verdict(self, delay):
        public_id = self.create_session().data['public_id']

        response = self.client.post(
            reverse('uploads:session-content', args=[public_id]),
            {'file': pdf_upload(PDF_BYTES, name='license.pdf')},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['state'], UploadState.QUARANTINED)
        self.assertFalse(response.data['ready_for_submit'])
        delay.assert_called_once()

    def test_cross_owner_detail_cancel_retry_and_content_are_indistinguishable_404(self):
        public_id = self.create_session().data['public_id']
        self.client.force_authenticate(self.other)
        urls = [
            reverse('uploads:session-detail', args=[public_id]),
            reverse('uploads:session-cancel', args=[public_id]),
            reverse('uploads:session-retry', args=[public_id]),
            reverse('uploads:session-content', args=[public_id]),
        ]

        detail = self.client.get(urls[0])
        cancel = self.client.post(urls[1], {}, format='json')
        retry = self.client.post(urls[2], {}, format='json')
        content = self.client.post(
            urls[3],
            {'file': pdf_upload(PDF_BYTES, name='license.pdf')},
            format='multipart',
        )

        for response in (detail, cancel, retry, content):
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.data['code'], 'RESOURCE_NOT_FOUND')

    def test_signature_spoof_and_wrong_size_never_create_quarantine_state(self):
        created = self.create_session()
        public_id = created.data['public_id']
        spoofed = pdf_upload(b'not-a-pdf', name='license.pdf')

        response = self.client.post(
            reverse('uploads:session-content', args=[public_id]),
            {'file': spoofed},
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'UPLOAD_CONTENT_MISMATCH')
        self.assertEqual(
            UploadSession.objects.get(public_id=public_id).state, UploadState.UPLOADING
        )

    def test_disabled_pipeline_fails_closed(self):
        with override_settings(UPLOAD_QUARANTINE_ENABLED=False):
            response = self.create_session()

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'UPLOAD_PIPELINE_DISABLED')

    def test_purpose_capability_is_role_bound_and_fails_closed(self):
        forbidden = self.client.post(
            reverse('uploads:session-create'),
            {
                'purpose': 'candidate_cv',
                'original_filename': 'candidate.pdf',
                'content_type': 'application/pdf',
                'size_bytes': len(PDF_BYTES),
            },
            format='json',
        )
        candidate = get_user_model().objects.create_user(
            email='upload-api-candidate@example.com',
            password='Password@123',
            role='candidate',
        )
        self.client.force_authenticate(candidate)
        allowed = self.client.post(
            reverse('uploads:session-create'),
            {
                'purpose': 'candidate_cv',
                'original_filename': 'candidate.pdf',
                'content_type': 'application/pdf',
                'size_bytes': len(PDF_BYTES),
            },
            format='json',
        )

        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(forbidden.data['code'], 'UPLOAD_PURPOSE_FORBIDDEN')
        self.assertEqual(allowed.status_code, 201)

    @override_settings(UPLOAD_OWNER_MAX_ACTIVE_SESSIONS=1)
    def test_active_session_quota_is_retryable_and_cancel_releases_capacity(self):
        first = self.create_session()
        blocked = self.create_session()

        self.assertEqual(first.status_code, 201)
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.data['code'], 'UPLOAD_SESSION_QUOTA_EXCEEDED')
        self.assertTrue(blocked.data['retryable'])

        cancelled = self.client.post(
            reverse('uploads:session-cancel', args=[first.data['public_id']]),
            {},
            format='json',
        )
        recovered = self.create_session()

        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(recovered.status_code, 201)

    @override_settings(UPLOAD_OWNER_MAX_ACTIVE_BYTES=len(PDF_BYTES) + 1)
    def test_active_byte_quota_uses_declared_bytes_and_fails_closed(self):
        first = self.create_session()
        blocked = self.create_session()

        self.assertEqual(first.status_code, 201)
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.data['code'], 'UPLOAD_BYTE_QUOTA_EXCEEDED')

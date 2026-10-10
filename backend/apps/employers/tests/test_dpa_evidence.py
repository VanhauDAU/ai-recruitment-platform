from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIRequestFactory, APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.accounts.services.tokens import issue_tokens

from ..models import EmployerDpaAcceptance, RecruiterProfile


class EmployerDpaEvidenceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='dpa-evidence@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            email_verified=True,
        )
        self.recruiter = RecruiterProfile.objects.create(
            user=self.user,
            dpa_accepted_at=timezone.now(),
        )
        login_request = APIRequestFactory().post('/login/', REMOTE_ADDR='198.51.100.10')
        tokens = issue_tokens(self.user, login_request)
        self.access = tokens['access']
        self.session_id = AccessToken(self.access)['sid']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access}')

    def current_payload(self):
        return {
            'policy_version': settings.EMPLOYER_DPA_POLICY_VERSION,
            'document_sha256': settings.EMPLOYER_DPA_DOCUMENT_SHA256,
        }

    def test_legacy_timestamp_is_not_fabricated_as_current_evidence(self):
        response = self.client.get(reverse('employer-me'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['dpa_status'], 'legacy_unversioned')
        self.assertFalse(response.data['candidate_data_access'])
        self.assertEqual(EmployerDpaAcceptance.objects.count(), 0)

    def test_acceptance_records_exact_policy_ip_session_and_hashed_user_agent(self):
        response = self.client.post(
            reverse('employer-dpa-accept'),
            self.current_payload(),
            format='json',
            REMOTE_ADDR='203.0.113.17',
            HTTP_USER_AGENT='Chrome DPA evidence test',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['dpa_status'], 'current')
        acceptance = EmployerDpaAcceptance.objects.get(recruiter=self.recruiter)
        self.assertEqual(acceptance.policy_version, settings.EMPLOYER_DPA_POLICY_VERSION)
        self.assertEqual(acceptance.document_sha256, settings.EMPLOYER_DPA_DOCUMENT_SHA256)
        self.assertEqual(acceptance.document_url, settings.EMPLOYER_DPA_DOCUMENT_URL)
        self.assertEqual(acceptance.ip_address, '203.0.113.17')
        self.assertEqual(str(acceptance.auth_session_id), self.session_id)
        self.assertEqual(len(acceptance.user_agent_hash), 64)
        self.assertNotIn('Chrome', acceptance.user_agent_hash)
        self.recruiter.refresh_from_db()
        self.assertEqual(
            self.recruiter.dpa_policy_version,
            settings.EMPLOYER_DPA_POLICY_VERSION,
        )
        self.assertEqual(
            self.recruiter.dpa_document_sha256,
            settings.EMPLOYER_DPA_DOCUMENT_SHA256,
        )

    def test_exact_reacceptance_is_idempotent(self):
        for _ in range(2):
            response = self.client.post(
                reverse('employer-dpa-accept'),
                self.current_payload(),
                format='json',
            )
            self.assertEqual(response.status_code, 200, response.data)

        self.assertEqual(EmployerDpaAcceptance.objects.count(), 1)

    def test_stale_document_is_rejected_without_evidence(self):
        response = self.client.post(
            reverse('employer-dpa-accept'),
            {'policy_version': 'old-v1', 'document_sha256': 'b' * 64},
            format='json',
        )

        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data['code'], 'DPA_POLICY_CHANGED')
        self.assertFalse(EmployerDpaAcceptance.objects.exists())

    @override_settings(
        EMPLOYER_DPA_POLICY_VERSION='test-dpa-v2',
        EMPLOYER_DPA_DOCUMENT_SHA256='b' * 64,
    )
    def test_previous_version_becomes_outdated(self):
        EmployerDpaAcceptance.objects.create(
            recruiter=self.recruiter,
            policy_version='test-dpa-v1',
            document_sha256='a' * 64,
            document_url='https://example.test/employer-dpa/test-dpa-v1',
        )
        self.recruiter.dpa_policy_version = 'test-dpa-v1'
        self.recruiter.dpa_document_sha256 = 'a' * 64
        self.recruiter.save(
            update_fields=['dpa_policy_version', 'dpa_document_sha256', 'updated_at']
        )

        response = self.client.get(reverse('employer-me'))

        self.assertEqual(response.data['dpa_status'], 'outdated')
        self.assertFalse(response.data['candidate_data_access'])

    @override_settings(EMPLOYER_DPA_POLICY_VERSION='', EMPLOYER_DPA_DOCUMENT_SHA256='')
    def test_unconfigured_policy_fails_closed(self):
        profile = self.client.get(reverse('employer-me'))
        response = self.client.post(
            reverse('employer-dpa-accept'),
            {'policy_version': 'test-dpa-v1', 'document_sha256': 'a' * 64},
            format='json',
        )

        self.assertFalse(profile.data['dpa_policy']['available'])
        self.assertEqual(profile.data['dpa_status'], 'legacy_unversioned')
        self.assertEqual(response.status_code, 503, response.data)
        self.assertEqual(response.data['code'], 'DPA_POLICY_UNAVAILABLE')
        self.assertFalse(EmployerDpaAcceptance.objects.exists())

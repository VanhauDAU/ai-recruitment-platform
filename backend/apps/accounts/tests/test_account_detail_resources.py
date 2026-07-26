from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.candidates.models import CandidateConsent, CandidateProfile

from ..models import AdminAccessAuditLog, User


class AdminAccountDetailResourceTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='account-detail-admin@example.com',
            password='Password@123',
        )
        self.candidate = User.objects.create_user(
            email='candidate-detail@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            full_name='Ứng viên kiểm thử',
            phone='0912345678',
        )
        self.profile = CandidateProfile.objects.get(user=self.candidate)
        self.profile.date_of_birth = date(1998, 5, 12)
        self.profile.address = 'Quận Cầu Giấy, Hà Nội'
        self.profile.headline = 'Backend Engineer'
        self.profile.save(
            update_fields=[
                'date_of_birth',
                'address',
                'headline',
                'updated_at',
            ]
        )
        self.consent = CandidateConsent.objects.create(
            candidate_profile=self.profile,
            consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
            decision=CandidateConsent.Decision.GRANTED,
            policy_version='2026-01',
        )
        self.client.force_authenticate(self.admin)
        self.profile_url = reverse(
            'admin-account-profile',
            kwargs={'public_id': self.candidate.public_id},
        )

    def test_sensitive_profile_is_masked_until_explicit_reveal_and_audited(self):
        masked = self.client.get(self.profile_url)

        self.assertEqual(masked.status_code, 200, masked.data)
        self.assertNotEqual(
            masked.data['candidate']['date_of_birth'],
            self.profile.date_of_birth.isoformat(),
        )
        self.assertNotEqual(masked.data['candidate']['address'], self.profile.address)
        self.assertFalse(
            AdminAccessAuditLog.objects.filter(action='reveal_account_sensitive_profile').exists()
        )

        revealed = self.client.get(self.profile_url, {'reveal': 'true'})

        self.assertEqual(revealed.status_code, 200, revealed.data)
        self.assertEqual(
            revealed.data['candidate']['date_of_birth'],
            self.profile.date_of_birth,
        )
        self.assertEqual(revealed.data['candidate']['address'], self.profile.address)
        self.assertTrue(
            AdminAccessAuditLog.objects.filter(
                action='reveal_account_sensitive_profile',
                target_public_id=self.candidate.public_id,
            ).exists()
        )

    def test_safe_profile_patch_does_not_modify_candidate_consent(self):
        response = self.client.patch(
            self.profile_url,
            {
                'headline': 'Senior Backend Engineer',
                'consent_type': CandidateConsent.ConsentType.RECRUITER_VISIBILITY,
                'decision': CandidateConsent.Decision.DENIED,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.profile.refresh_from_db()
        self.consent.refresh_from_db()
        self.assertEqual(self.profile.headline, 'Senior Backend Engineer')
        self.assertEqual(self.consent.decision, CandidateConsent.Decision.GRANTED)
        self.assertEqual(self.profile.consents.count(), 1)

    def test_consent_subresource_uses_paginated_contract(self):
        response = self.client.get(
            reverse(
                'admin-account-consents',
                kwargs={'public_id': self.candidate.public_id},
            )
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            response.data['results'][0]['consent_type'],
            CandidateConsent.ConsentType.AI_RECOMMENDATION,
        )

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.cvs.models import UserCv

from ..models import CandidateConsent, CandidateConsentEvent
from ..selectors import candidate_profile_for_user, recruiter_visibility_consent
from ..services import set_recruiter_visibility, update_candidate_profile


class CandidateProfileServiceTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            email='candidate@example.com', password='password', role='candidate'
        )
        self.other = User.objects.create_user(
            email='other@example.com', password='password', role='candidate'
        )
        self.profile = candidate_profile_for_user(self.user)

    def cv(self, user):
        return UserCv.objects.create(
            user=user,
            title='CV',
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            language='vi-VN',
        )

    def visibility(self, **kwargs):
        return set_recruiter_visibility(
            self.profile, enabled=True, policy_version='v1', source='cv_save_success', **kwargs
        )

    def test_update_profile_saves_only_given_fields(self):
        update_candidate_profile(self.profile, {'gender': 'female'})

        self.assertEqual(candidate_profile_for_user(self.user).gender, 'female')

    def test_visibility_rejects_a_cv_of_another_account(self):
        with self.assertRaises(ValidationError) as error:
            self.visibility(cv_public_id=self.cv(self.other).public_id)

        self.assertIn('cv_public_id', error.exception.detail)
        self.assertFalse(CandidateConsentEvent.objects.exists())
        self.assertIsNone(recruiter_visibility_consent(self.profile))

    def test_visibility_with_own_cv_records_consent_and_event(self):
        own = self.cv(self.user)

        consent = self.visibility(cv_public_id=own.public_id)

        self.assertEqual(consent.decision, CandidateConsent.Decision.GRANTED)
        self.assertEqual(recruiter_visibility_consent(self.profile), consent)
        self.assertEqual(CandidateConsentEvent.objects.get().cv_public_id, own.public_id)

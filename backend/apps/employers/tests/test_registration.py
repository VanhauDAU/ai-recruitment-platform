"""Employer registration and the onboarding recruitment need."""

from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import AuthEmailJob, SocialAccount, User
from apps.jobs.models import JobCategory
from apps.locations.models import Location
from apps.sitecontent.models import SiteSetting

from ..models import (
    RecruiterProfile,
    RecruitmentNeed,
)
from .factories import (
    make_recruiter,
)


@override_settings(
    RECAPTCHA_SECRET_KEY='',
    DEBUG=True,
    ALLOWED_HOSTS=['testserver'],
    EMPLOYER_TERMS_POLICY_VERSION='test-v1',
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class EmployerRegistrationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.location = Location.objects.create(
            code='01',
            level=Location.Level.PROVINCE,
            name='Hà Nội',
        )
        self.payload = {
            'email': 'hr@acme.vn',
            'password': 'Password@123',
            'captcha_token': 'test-captcha',
            'full_name': 'Nguyễn Minh Anh',
            'gender': 'female',
            'contact_phone': '0912345678',
            'work_location': self.location.id,
            'terms_accepted': True,
            'marketing_opt_in': False,
        }

    def test_closed_employer_registration_is_rejected_before_creating_anything(self):
        SiteSetting.objects.update_or_create(
            key='employer_allow_registration',
            defaults={'value': False, 'value_type': SiteSetting.ValueType.BOOLEAN},
        )

        response = self.client.post(reverse('employer-register'), self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'registration_closed')
        self.assertFalse(User.objects.filter(email='hr@acme.vn').exists())

    def test_email_registration_creates_recruiter_consent_without_auto_linking_company(self):
        response = self.client.post(reverse('employer-register'), self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        self.assertTrue(response.cookies['procv_refresh_employer'].value)
        self.assertTrue(response.data['user']['employer_onboarding_required'])

        user = User.objects.get(email='hr@acme.vn')
        recruiter = RecruiterProfile.objects.select_related('company', 'work_location').get(
            user=user
        )
        self.assertEqual(user.role, User.Role.EMPLOYER)
        self.assertEqual(user.phone, '0912345678')
        self.assertEqual(recruiter.gender, RecruiterProfile.Gender.FEMALE)
        self.assertEqual(recruiter.contact_phone, '0912345678')
        self.assertEqual(recruiter.work_location, self.location)
        self.assertIsNone(recruiter.company)
        self.assertFalse(response.data['recruiter']['onboarding']['company_linked'])
        self.assertEqual(recruiter.terms_policy_version, 'test-v1')
        self.assertIsNotNone(recruiter.terms_accepted_at)
        self.assertFalse(recruiter.marketing_opt_in)
        self.assertIsNotNone(user.last_login)
        self.assertTrue(
            AuthEmailJob.objects.filter(
                user=user,
                kind=AuthEmailJob.Kind.VERIFICATION,
            ).exists()
        )
        self.assertFalse(
            AuthEmailJob.objects.filter(
                user=user,
                kind=AuthEmailJob.Kind.WELCOME,
            ).exists()
        )

    def test_registration_requires_mandatory_terms(self):
        response = self.client.post(
            reverse('employer-register'),
            {**self.payload, 'terms_accepted': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('terms_accepted', response.data)
        self.assertFalse(User.objects.filter(email='hr@acme.vn').exists())

    def test_a_failed_captcha_hides_whether_the_email_already_belongs_to_an_employer(self):
        """Captcha phải chặn TRƯỚC validator email, nếu không đây là oracle dò email.

        Serializer chạy trước captcha thì kẻ tấn công gửi captcha_token rác vẫn
        đọc được thông điệp "email đã được sử dụng" — dò sạch danh sách NTD mà
        không tốn một lượt captcha nào.
        """
        User.objects.create_user(
            email='hr@acme.vn', password='Password@123', role=User.Role.EMPLOYER
        )

        with (
            override_settings(RECAPTCHA_SECRET_KEY='server-secret'),
            patch('apps.accounts.services.captcha.requests.post') as verify,
        ):
            verify.return_value.json.return_value = {'success': False}
            response = self.client.post(reverse('employer-register'), self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('captcha_token', response.data)
        self.assertNotIn('email', response.data)

    def test_a_duplicate_slipping_past_validation_is_a_400_not_a_500(self):
        """Cửa sổ TOCTOU giữa validate_email và create_user phải trả lỗi tử tế.

        Hai request song song cùng email đều qua được validator rồi mới đụng
        ràng buộc uniq_users_email_role_lower ở DB.
        """
        User.objects.create_user(
            email='hr@acme.vn', password='Password@123', role=User.Role.EMPLOYER
        )

        with patch.object(User.objects, 'email_claimed_for_role', return_value=False):
            response = self.client.post(reverse('employer-register'), self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn('email', response.data)
        self.assertEqual(User.objects.filter(email='hr@acme.vn').count(), 1)

    def test_registration_rejects_email_reserved_by_existing_oauth_employer(self):
        oauth_user = User.objects.create_user(
            email='oauth-current@acme.vn',
            password=None,
            role=User.Role.EMPLOYER,
        )
        SocialAccount.objects.create(
            user=oauth_user,
            provider=User.Provider.GOOGLE,
            provider_user_id='google-employer-existing',
            email=self.payload['email'],
        )

        response = self.client.post(reverse('employer-register'), self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertEqual(
            User.objects.filter(role=User.Role.EMPLOYER).count(),
            1,
        )

    def test_registration_rejects_weak_password_and_allows_duplicate_contact_phone(self):
        weak = self.client.post(
            reverse('employer-register'),
            {**self.payload, 'password': 'matkhaudai'},
            format='json',
        )
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', weak.data)

        first = self.client.post(reverse('employer-register'), self.payload, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        duplicate = self.client.post(
            reverse('employer-register'),
            {**self.payload, 'email': 'other@acme.vn'},
            format='json',
        )
        self.assertEqual(duplicate.status_code, status.HTTP_201_CREATED, duplicate.data)
        self.assertEqual(
            RecruiterProfile.objects.filter(contact_phone='0912345678').count(),
            2,
        )

    def test_google_employer_can_complete_registration_profile_once(self):
        user = User.objects.create_user(
            email='google@acme.vn',
            password=None,
            role=User.Role.EMPLOYER,
            email_verified=True,
        )
        self.client.force_authenticate(user=user)
        profile_payload = {
            key: value
            for key, value in self.payload.items()
            if key
            not in {
                'email',
                'password',
                'captcha_token',
            }
        }

        response = self.client.post(
            reverse('employer-registration-complete'),
            profile_payload,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data['onboarding']['account_ready'])
        self.assertIsNone(response.data['company'])
        second = self.client.post(
            reverse('employer-registration-complete'),
            profile_payload,
            format='json',
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

        other_user = User.objects.create_user(
            email='other-google@acme.vn',
            password=None,
            role=User.Role.EMPLOYER,
            email_verified=True,
        )
        RecruiterProfile.objects.create(user=other_user)
        self.client.force_authenticate(user=other_user)
        duplicate_phone = self.client.post(
            reverse('employer-registration-complete'),
            profile_payload,
            format='json',
        )
        self.assertEqual(duplicate_phone.status_code, status.HTTP_200_OK, duplicate_phone.data)


class RecruitmentNeedTests(APITestCase):
    def setUp(self):
        self.user, self.recruiter = make_recruiter(phone_verified=False)
        self.user.email_verified = True
        self.user.save(update_fields=['email_verified', 'updated_at'])
        self.recruiter.registration_completed_at = timezone.now()
        self.recruiter.save()
        self.category = JobCategory.objects.create(
            name='Kinh doanh phần mềm',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.payload = {
            'position_category': self.category.id,
            'position_level': RecruitmentNeed.PositionLevel.EMPLOYEE,
            'target_date': (timezone.localdate() + timedelta(days=30)).isoformat(),
            'is_continuous': False,
            'headcount': 3,
            'budget_min': 5_000_000,
            'budget_max': 10_000_000,
            'budget_source': RecruitmentNeed.BudgetSource.COMPANY,
            'consultation_topics': [RecruitmentNeed.ConsultationTopic.PROMOTIONS],
        }
        self.client.force_authenticate(user=self.user)

    def test_verified_employer_finishes_onboarding_without_recruitment_need(self):
        session = self.client.get(reverse('auth-me'))

        self.assertFalse(session.data['employer_onboarding_required'])
        self.assertEqual(session.data['employer_onboarding_step'], 'complete')
        self.assertFalse(session.data['employer_verification_completed'])
        self.assertFalse(RecruitmentNeed.objects.filter(recruiter=self.recruiter).exists())

    def test_recruitment_demand_crud_manages_needs(self):
        first = self.client.post(reverse('employer-recruitment-needs'), self.payload, format='json')
        second = self.client.post(
            reverse('employer-recruitment-needs'),
            {
                **self.payload,
                'headcount': 5,
                'is_continuous': True,
                'target_date': None,
            },
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(first.data['position_category_name'], self.category.name)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        listed = self.client.get(reverse('employer-recruitment-needs'))
        self.assertEqual(listed.status_code, status.HTTP_200_OK, listed.data)
        self.assertEqual(len(listed.data), 2)

        detail_url = reverse('employer-recruitment-need-detail', args=[second.data['public_id']])
        toggled = self.client.patch(detail_url, {'is_active': False}, format='json')
        self.assertEqual(toggled.status_code, status.HTTP_200_OK, toggled.data)
        self.assertFalse(toggled.data['is_active'])
        deleted = self.client.delete(detail_url)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RecruitmentNeed.objects.filter(recruiter=self.recruiter).count(), 1)

    def test_recruitment_need_rejects_non_specialization_category(self):
        domain = JobCategory.objects.create(
            name='Công nghệ',
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        response = self.client.post(
            reverse('employer-recruitment-needs'),
            {
                **self.payload,
                'position_category': domain.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('position_category', response.data)

    def test_recruitment_need_rejects_past_date_and_inverted_budget(self):
        past_date = self.client.post(
            reverse('employer-recruitment-needs'),
            {
                **self.payload,
                'target_date': (timezone.localdate() - timedelta(days=1)).isoformat(),
            },
            format='json',
        )
        self.assertEqual(past_date.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('target_date', past_date.data)

        inverted_budget = self.client.post(
            reverse('employer-recruitment-needs'),
            {
                **self.payload,
                'budget_min': 20_000_000,
                'budget_max': 10_000_000,
            },
            format='json',
        )
        self.assertEqual(inverted_budget.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('budget_max', inverted_budget.data)

    def test_recruitment_need_rejects_budget_below_one_million(self):
        response = self.client.post(
            reverse('employer-recruitment-needs'),
            {
                **self.payload,
                'budget_min': 999_999,
                'budget_max': 2_000_000,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('budget_min', response.data)

    def test_recruitment_need_accepts_at_most_one_consultation_topic(self):
        response = self.client.post(
            reverse('employer-recruitment-needs'),
            {
                **self.payload,
                'consultation_topics': [
                    RecruitmentNeed.ConsultationTopic.FREE_POSTING,
                    RecruitmentNeed.ConsultationTopic.PROMOTIONS,
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('consultation_topics', response.data)

    def test_continuous_hiring_clears_target_date_and_budget_is_optional(self):
        response = self.client.post(
            reverse('employer-recruitment-needs'),
            {
                **self.payload,
                'target_date': None,
                'is_continuous': True,
                'budget_min': None,
                'budget_max': None,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data['target_date'])

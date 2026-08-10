import shutil
import tempfile
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.accounts.models import AuthEmailJob, SocialAccount, User
from apps.accounts.services.tokens import issue_tokens
from apps.jobs.models import JobCategory
from apps.locations.models import Location
from common.r2_storage import private_media_storage

from .. import services
from ..models import (
    Company,
    CompanyDocument,
    CompanyImage,
    CompanyTaxLookupEvidence,
    CompanyUpdateRequest,
    EmployerDpaAcceptance,
    EmployerVerificationCase,
    Industry,
    PhoneOtp,
    RecruiterProfile,
    RecruitmentNeed,
)
from ..services.phone_challenges import dispatch_sms_phone_challenge
from ..services.sms_provider import FakeSmsProvider

PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
    b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
    b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
    b'\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)
PDF_BYTES = b'%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'
DOCX_BYTES = b'PK\x03\x04' + (b'\x00' * 64)
TEST_MEDIA_ROOT = tempfile.mkdtemp()


def make_employer(email='employer@example.com', phone_verified=True):
    user = User.objects.create_user(
        email=email,
        password='Password@123',
        role=User.Role.EMPLOYER,
        two_factor_enabled=True,
    )
    recruiter = RecruiterProfile.objects.create(user=user)
    if phone_verified:
        recruiter.verified_phone = f'09{abs(hash(email)) % 10**8:08d}'
        recruiter.phone_verified_at = timezone.now()
        recruiter.save()
    return user, recruiter


def authenticate_employer(client, user):
    tokens = issue_tokens(user, auth_method='mfa')
    client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])


def company_payload(industry, **overrides):
    payload = {
        'business_type': 'enterprise',
        'tax_code': '0101234567',
        'company_name': 'Acme Corp',
        'has_no_website': True,
        'email': 'contact@acme.vn',
        'phone': '02412345678',
        'address': 'Hà Nội',
        'company_size': '25-99',
        'description': 'Công ty phần mềm.',
        'industries': [industry.id],
        'primary_industry': industry.id,
    }
    payload.update(overrides)
    return payload


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
        self.assertFalse(response.data['onboarding']['account_ready'])
        self.assertFalse(response.data['onboarding']['consulting_need_completed'])
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
        self.user, self.recruiter = make_employer(phone_verified=False)
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
            'consultation_topics': [RecruitmentNeed.ConsultationTopic.SERVICE_PACKAGES],
        }
        self.client.force_authenticate(user=self.user)

    def test_verified_employer_completes_consulting_need_and_session_becomes_ready(self):
        response = self.client.post(
            reverse('employer-consulting-need'), self.payload, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        need = RecruitmentNeed.objects.get(recruiter=self.recruiter)
        self.assertEqual(need.position_category, self.category)
        self.assertEqual(need.headcount, 3)
        detail = self.client.get(reverse('employer-consulting-need'))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data['public_id'], need.public_id)
        self.assertEqual(detail.data['position_category_name'], self.category.name)

        session = self.client.get(reverse('auth-me'))
        self.assertFalse(session.data['employer_onboarding_required'])
        self.assertEqual(session.data['employer_onboarding_step'], 'complete')
        self.assertFalse(session.data['employer_verification_completed'])

        repeated = self.client.post(
            reverse('employer-consulting-need'), self.payload, format='json'
        )
        self.assertEqual(repeated.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('đã hoàn tất', str(repeated.data['detail']))

    def test_unverified_email_cannot_submit_consulting_need(self):
        self.user.email_verified = False
        self.user.save(update_fields=['email_verified', 'updated_at'])

        response = self.client.post(
            reverse('employer-consulting-need'), self.payload, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(RecruitmentNeed.objects.filter(recruiter=self.recruiter).exists())

    def test_recruitment_demand_crud_keeps_onboarding_need_and_manages_more_needs(self):
        first = self.client.post(reverse('employer-consulting-need'), self.payload, format='json')
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

        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
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

    def test_consulting_need_rejects_non_specialization_category(self):
        domain = JobCategory.objects.create(
            name='Công nghệ',
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        response = self.client.post(
            reverse('employer-consulting-need'),
            {
                **self.payload,
                'position_category': domain.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('position_category', response.data)

    def test_consulting_need_rejects_past_date_and_inverted_budget(self):
        past_date = self.client.post(
            reverse('employer-consulting-need'),
            {
                **self.payload,
                'target_date': (timezone.localdate() - timedelta(days=1)).isoformat(),
            },
            format='json',
        )
        self.assertEqual(past_date.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('target_date', past_date.data)

        inverted_budget = self.client.post(
            reverse('employer-consulting-need'),
            {
                **self.payload,
                'budget_min': 20_000_000,
                'budget_max': 10_000_000,
            },
            format='json',
        )
        self.assertEqual(inverted_budget.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('budget_max', inverted_budget.data)

    def test_consulting_need_rejects_budget_below_one_million(self):
        response = self.client.post(
            reverse('employer-consulting-need'),
            {
                **self.payload,
                'budget_min': 999_999,
                'budget_max': 2_000_000,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('budget_min', response.data)

    def test_consulting_need_accepts_at_most_one_consultation_topic(self):
        response = self.client.post(
            reverse('employer-consulting-need'),
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
            reverse('employer-consulting-need'),
            {
                **self.payload,
                'target_date': None,
                'is_continuous': True,
                'budget_min': None,
                'budget_max': None,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIsNone(response.data['target_date'])


@override_settings(
    EMPLOYER_SMS_OTP_ENABLED=True,
    EMPLOYER_SMS_PROVIDER='fake',
    EMPLOYER_SMS_SENDER='ProCV',
    EMPLOYER_SMS_TEMPLATE_ID='employer-phone-otp-v1',
    IS_PRODUCTION=False,
)
class PhoneOtpTests(APITestCase):
    def setUp(self):
        self.user, self.recruiter = make_employer(phone_verified=False)
        self.client.force_authenticate(user=self.user)

    def _send_otp(self, phone='0912345678', password='Password@123'):
        with (
            patch(
                'apps.employers.services.phone_challenges.secrets.randbelow', return_value=123456
            ),
            patch('apps.employers.services.phone_challenges.current_app.send_task'),
            self.captureOnCommitCallbacks(execute=True),
        ):
            response = self.client.post(
                reverse('employer-phone-send-otp'),
                {'phone': phone, 'password': password},
            )
        if response.status_code == status.HTTP_202_ACCEPTED:
            self.challenge_id = response.data['public_id']
            dispatch_sms_phone_challenge(self.challenge_id, provider=FakeSmsProvider())
        return response

    def test_send_and_verify_otp_marks_phone_verified(self):
        response = self._send_otp()
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        response = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': self.challenge_id, 'code': '123456'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.recruiter.refresh_from_db()
        self.assertEqual(self.recruiter.verified_phone, '+84912345678')
        self.assertIsNotNone(self.recruiter.phone_verified_at)

    def test_verifying_phone_last_does_not_approve_a_fully_reviewed_case(self):
        now = timezone.now()
        self.user.email_verified = True
        self.user.save(update_fields=['email_verified', 'updated_at'])
        company = Company.objects.create(
            company_name='Công ty hoàn tất điện thoại sau cùng',
            tax_code='0109876543',
            created_by=self.user,
        )
        self.recruiter.company = company
        self.recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        self.recruiter.registration_completed_at = now
        self.recruiter.dpa_accepted_at = now
        self.recruiter.save(
            update_fields=[
                'company',
                'company_role',
                'registration_completed_at',
                'dpa_accepted_at',
                'updated_at',
            ]
        )
        category = JobCategory.objects.create(
            name='Kiểm thử reconcile điện thoại',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        RecruitmentNeed.objects.create(
            recruiter=self.recruiter,
            position_category=category,
            position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
            is_continuous=True,
            headcount=1,
            budget_source=RecruitmentNeed.BudgetSource.COMPANY,
            completed_at=now,
        )
        verification_case = EmployerVerificationCase.objects.create(
            recruiter=self.recruiter,
            company=company,
            verification_method=EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION,
            status=EmployerVerificationCase.Status.IN_REVIEW,
            submitted_at=now,
            review_started_at=now,
        )
        for index, doc_type in enumerate(
            (
                CompanyDocument.DocType.BUSINESS_REGISTRATION,
                CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            ),
            start=1,
        ):
            CompanyDocument.objects.create(
                company=company,
                recruiter=self.recruiter,
                uploaded_by=self.user,
                verification_case=verification_case,
                doc_type=doc_type,
                file_url=f'employers/reconcile/{doc_type}.pdf',
                file_name=f'{doc_type}.pdf',
                mime_type='application/pdf',
                file_size=1024,
                sha256=f'{index:064x}',
                status=CompanyDocument.Status.APPROVED,
                reviewed_at=now,
            )

        self._send_otp()
        response = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': self.challenge_id, 'code': '123456'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        verification_case.refresh_from_db()
        company.refresh_from_db()
        self.assertEqual(verification_case.status, EmployerVerificationCase.Status.IN_REVIEW)
        self.assertNotEqual(company.verification_status, Company.VerificationStatus.VERIFIED)

    def test_sms_dispatch_is_deferred_until_commit(self):
        """Challenge ID only enters the broker after the database commit."""
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            response = self.client.post(
                reverse('employer-phone-send-otp'),
                {'phone': '0912345678', 'password': 'Password@123'},
            )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(len(callbacks), 1)

    def test_wrong_otp_rejected_and_attempts_counted(self):
        self._send_otp()
        response = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': self.challenge_id, 'code': '000000'},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PhoneOtp.objects.get(user=self.user).attempts, 1)

    def test_phone_already_verified_by_other_recruiter_is_rejected(self):
        other_user, other = make_employer('other@example.com', phone_verified=False)
        other.verified_phone = '0912345678'
        other.phone_verified_at = timezone.now()
        other.save()

        self._send_otp()
        response = self.client.post(
            reverse('employer-phone-verify'),
            {'challenge_id': self.challenge_id, 'code': '123456'},
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'PHONE_UNAVAILABLE')

    def test_send_otp_rejects_wrong_password(self):
        response = self._send_otp(password='Wrong@123')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'PHONE_REAUTH_FAILED')

    def test_send_otp_requires_password(self):
        response = self.client.post(reverse('employer-phone-send-otp'), {'phone': '0912345678'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'PHONE_REAUTH_FAILED')

    def test_phone_availability_does_not_disclose_taken_numbers(self):
        other_user, other = make_employer('other@example.com', phone_verified=False)
        other.verified_phone = '0912345678'
        other.phone_verified_at = timezone.now()
        other.save()

        taken = self.client.get(reverse('employer-phone-check'), {'phone': '0912345678'})
        self.assertEqual(taken.status_code, status.HTTP_200_OK)
        self.assertTrue(taken.data['available'])

        free = self.client.get(reverse('employer-phone-check'), {'phone': '0987654321'})
        self.assertEqual(free.status_code, status.HTTP_200_OK)
        self.assertTrue(free.data['available'])

    def test_oauth_account_without_password_must_create_password_first(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=['password', 'updated_at'])

        response = self._send_otp()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'PHONE_REAUTH_REQUIRED')


class CompanyCreateTests(APITestCase):
    def setUp(self):
        self.user, self.recruiter = make_employer()
        self.industry = Industry.objects.create(name='Công nghệ thông tin')
        authenticate_employer(self.client, self.user)

    def test_create_company_links_recruiter_as_approved_owner(self):
        response = self.client.post(
            reverse('employer-company-create'), company_payload(self.industry), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        self.recruiter.refresh_from_db()
        company = self.recruiter.company
        self.assertEqual(company.company_name, 'Acme Corp')
        self.assertEqual(company.verification_status, Company.VerificationStatus.UNVERIFIED)
        self.assertEqual(self.recruiter.company_role, RecruiterProfile.CompanyRole.OWNER)
        self.assertTrue(company.company_industries.get(industry=self.industry).is_primary)

    def test_create_does_not_require_verified_phone(self):
        user, _ = make_employer('newbie@example.com', phone_verified=False)
        authenticate_employer(self.client, user)
        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry, tax_code='0207654321'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_create_does_not_require_mfa(self):
        self.user.two_factor_enabled = False
        self.user.save(update_fields=['two_factor_enabled'])

        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_primary_industry_must_be_among_selected(self):
        other = Industry.objects.get(name='Bảo hiểm')
        payload = company_payload(self.industry, primary_industry=other.id)
        response = self.client.post(reverse('employer-company-create'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_change_company_once_linked(self):
        self.client.post(
            reverse('employer-company-create'), company_payload(self.industry), format='json'
        )
        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry, tax_code='0207654321'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_tax_code_and_company_name_are_accepted_for_admin_review(self):
        self.client.post(
            reverse('employer-company-create'), company_payload(self.industry), format='json'
        )
        user2, _ = make_employer('hr2@example.com')
        authenticate_employer(self.client, user2)
        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry, company_name='Acme Fake'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        duplicate = Company.objects.get(public_id=response.data['public_id'])
        self.assertEqual(duplicate.tax_code, '0101234567')
        self.assertEqual(duplicate.verification_status, Company.VerificationStatus.UNVERIFIED)

        user3, _ = make_employer('hr3@example.com')
        authenticate_employer(self.client, user3)
        same_name_response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry),
            format='json',
        )
        self.assertEqual(
            same_name_response.status_code,
            status.HTTP_201_CREATED,
            same_name_response.data,
        )
        self.assertEqual(
            Company.objects.filter(
                tax_code='0101234567',
                company_name='Acme Corp',
            ).count(),
            2,
        )
        original = Company.objects.get(created_by=self.user)
        same_name = Company.objects.get(public_id=same_name_response.data['public_id'])
        self.assertNotEqual(original.slug, same_name.slug)

    def test_tax_code_is_normalized_and_rich_text_is_sanitized(self):
        payload = company_payload(
            self.industry,
            tax_code='010 123 4567',
            description='<p onclick="steal()">Công ty <strong>an toàn</strong><script>alert(1)</script></p>',
        )
        response = self.client.post(reverse('employer-company-create'), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        company = Company.objects.get(public_id=response.data['public_id'])
        self.assertEqual(company.tax_code, '0101234567')
        self.assertEqual(company.description, '<p>Công ty <strong>an toàn</strong></p>')

    def test_company_catalogs_are_server_driven(self):
        response = self.client.get(reverse('employer-company-catalogs'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(
            {'value': 'enterprise', 'label': 'Doanh nghiệp'}, response.data['business_types']
        )
        self.assertTrue(response.data['company_sizes'])
        self.assertTrue(response.data['markets'])
        self.assertTrue(response.data['target_customers'])

    def test_registration_placeholder_does_not_block_explicit_company_creation(self):
        placeholder = Company.objects.create(
            company_name='Tên khai báo ban đầu',
            has_no_logo=True,
            has_no_website=True,
            created_by=self.user,
        )
        self.recruiter.company = placeholder
        self.recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        self.recruiter.save()

        before = self.client.get(reverse('employer-me'))
        response = self.client.post(
            reverse('employer-company-create'), company_payload(self.industry), format='json'
        )

        self.assertFalse(before.data['onboarding']['company_linked'])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.recruiter.refresh_from_db()
        self.assertNotEqual(self.recruiter.company, placeholder)


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, ALLOWED_HOSTS=['testserver'])
class JoinCompanyTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        owner, _ = make_employer('owner@example.com')
        self.company = Company.objects.create(
            company_name='Acme Corp', tax_code='0101234567', created_by=owner
        )
        self.user, self.recruiter = make_employer('hr2@example.com')
        authenticate_employer(self.client, self.user)

    def _join(self):
        return self.client.post(
            reverse('employer-company-join'),
            {
                'company': self.company.public_id,
            },
            format='multipart',
        )

    def test_search_finds_company_by_name_and_tax_code(self):
        for q in ['Acme', '0101234567']:
            response = self.client.get(reverse('employer-company-search'), {'q': q})
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data['results'][0]['public_id'], self.company.public_id)

    def test_blank_search_returns_six_recent_real_companies_and_excludes_placeholder(self):
        for index in range(7):
            Company.objects.create(
                company_name=f'Công ty mới {index}',
                tax_code=f'02000000{index:02d}',
                created_by=self.user,
            )
        Company.objects.create(
            company_name='Placeholder cũ',
            has_no_logo=True,
            has_no_website=True,
            created_by=self.user,
        )

        response = self.client.get(reverse('employer-company-search'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 6)
        names = [item['company_name'] for item in response.data['results']]
        self.assertNotIn('Placeholder cũ', names)
        self.assertEqual(names[0], 'Công ty mới 6')

    def test_join_links_recruiter_immediately(self):
        response = self._join()
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertNotIn('membership_status', response.data)

        self.recruiter.refresh_from_db()
        self.assertEqual(self.recruiter.company, self.company)
        self.assertEqual(self.recruiter.company_role, RecruiterProfile.CompanyRole.MEMBER)

    def test_joining_verified_company_does_not_inherit_other_recruiter_documents(self):
        self.company.verification_status = Company.VerificationStatus.VERIFIED
        self.company.verified_at = timezone.now()
        self.company.save(update_fields=['verification_status', 'verified_at', 'updated_at'])
        for doc_type in (
            CompanyDocument.DocType.BUSINESS_REGISTRATION,
            CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        ):
            CompanyDocument.objects.create(
                company=self.company,
                uploaded_by=self.company.created_by,
                doc_type=doc_type,
                file_url=f'employers/owner/{doc_type}.pdf',
                file_name=f'{doc_type}.pdf',
                status=CompanyDocument.Status.APPROVED,
            )

        join_response = self._join()
        profile_response = self.client.get(reverse('employer-me'))
        documents_response = self.client.get(reverse('employer-company-documents'))

        self.assertEqual(join_response.status_code, status.HTTP_200_OK, join_response.data)
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK, profile_response.data)
        onboarding = profile_response.data['onboarding']
        self.assertTrue(onboarding['company_linked'])
        self.assertFalse(onboarding['business_doc_submitted'])
        self.assertFalse(onboarding['candidate_dpa_submitted'])
        self.assertFalse(onboarding['dpa_accepted'])
        self.assertFalse(onboarding['verification_completed'])
        self.assertEqual(documents_response.status_code, status.HTTP_200_OK)
        self.assertEqual(documents_response.data, [])

    def test_join_does_not_require_verified_phone(self):
        self.recruiter.verified_phone = ''
        self.recruiter.phone_verified_at = None
        self.recruiter.save(update_fields=['verified_phone', 'phone_verified_at', 'updated_at'])

        response = self._join()

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_join_rejects_legacy_membership_proof(self):
        response = self.client.post(
            reverse('employer-company-join'),
            {
                'company': self.company.public_id,
                'proof_type': 'business_registration',
                'business_registration_file': SimpleUploadedFile(
                    'gdkd.png', PNG_BYTES, content_type='image/png'
                ),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('không yêu cầu', str(response.data))

    def test_cannot_select_or_create_another_company_after_joining(self):
        first = self._join()
        other_company = Company.objects.create(
            company_name='Công ty khác', tax_code='0207654321', created_by=self.user
        )
        second = self.client.post(
            reverse('employer-company-join'),
            {
                'company': other_company.public_id,
            },
            format='multipart',
        )
        industry = Industry.objects.get(name='Bảo hiểm')
        create = self.client.post(
            reverse('employer-company-create'),
            company_payload(industry, tax_code='0307654321'),
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('không thể đổi công ty khác', str(second.data))
        self.assertEqual(create.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('không thể tạo hoặc đổi công ty khác', str(create.data))

    def test_candidate_dpa_can_be_saved_without_mfa_requirement(self):
        self.user.two_factor_enabled = False
        self.user.save(update_fields=['two_factor_enabled'])
        media_root = tempfile.mkdtemp()
        try:
            with self.settings(MEDIA_ROOT=media_root):
                first = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                        'file': SimpleUploadedFile(
                            'thoa-thuan-cu.docx',
                            DOCX_BYTES,
                            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        ),
                    },
                    format='multipart',
                )
                replacement = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                        'file': SimpleUploadedFile(
                            'thoa-thuan-moi.docx',
                            DOCX_BYTES,
                            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        ),
                    },
                    format='multipart',
                )
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(replacement.status_code, status.HTTP_201_CREATED, replacement.data)
        documents = CompanyDocument.objects.filter(
            recruiter=self.recruiter,
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        )
        self.assertEqual(documents.count(), 2)
        previous = documents.get(pk=first.data['id'])
        document = documents.get(pk=replacement.data['id'])
        self.assertIsNone(document.company)
        self.assertEqual(document.file_name, 'Thỏa thuận xử lý DLCN')
        self.assertFalse(previous.is_current)
        self.assertTrue(document.is_current)
        self.assertEqual(document.version, 2)
        self.assertEqual(document.supersedes, previous)
        self.assertTrue(
            self.client.get(reverse('employer-me')).data['onboarding']['candidate_dpa_submitted']
        )
        listed = self.client.get(reverse('employer-company-documents'))
        self.assertEqual(listed.status_code, status.HTTP_200_OK, listed.data)
        self.assertEqual(len(listed.data), 2)
        self.assertEqual(listed.data[0]['id'], document.id)

    def test_current_recruiter_dpa_is_listed_before_legacy_company_dpa(self):
        self.recruiter.company = self.company
        self.recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        self.recruiter.save(update_fields=['company', 'company_role', 'updated_at'])
        CompanyDocument.objects.create(
            company=self.company,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            file_url='employers/legacy-company-dpa.pdf',
            file_name='Thỏa thuận xử lý DLCN',
        )
        current_document = CompanyDocument.objects.create(
            recruiter=self.recruiter,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            file_url='employers/current-recruiter-dpa.docx',
            file_name='Thỏa thuận xử lý DLCN',
        )

        response = self.client.get(reverse('employer-company-documents'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data[0]['id'], current_document.id)
        self.assertEqual(
            response.data[0]['file_url'],
            f'http://testserver{reverse("employer-company-document-content", kwargs={"pk": current_document.pk})}',
        )

    def test_join_does_not_require_mfa(self):
        self.user.two_factor_enabled = False
        self.user.save(update_fields=['two_factor_enabled'])

        response = self._join()

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_trade_name_proof_can_be_saved_as_website(self):
        self.recruiter.company = self.company
        self.recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        self.recruiter.save(update_fields=['company', 'company_role', 'updated_at'])

        response = self.client.post(
            reverse('employer-company-documents'),
            {
                'doc_type': CompanyDocument.DocType.TRADE_NAME_PROOF,
                'source_type': 'website',
                'website_url': 'https://example.com/thuong-hieu',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['source_type'], 'website')
        self.assertEqual(response.data['file_url'], 'https://example.com/thuong-hieu')
        document = CompanyDocument.objects.get(doc_type=CompanyDocument.DocType.TRADE_NAME_PROOF)
        self.assertEqual(document.file_name, 'Website chứng minh tên thương mại')

    def test_private_company_document_is_served_only_to_an_authorised_employer(self):
        self._join()
        stored_name = private_media_storage().save(
            'employers/documents/company-registration.png', ContentFile(PNG_BYTES)
        )
        document = CompanyDocument.objects.create(
            company=self.company,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url=stored_name,
            file_name='company-registration.png',
        )

        with patch(
            'apps.employers.api.views.verification.render_office_document_preview',
            return_value=None,
        ):
            response = self.client.get(
                reverse('employer-company-document-content', kwargs={'pk': document.pk})
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(b''.join(response.streaming_content), PNG_BYTES)
        self.assertEqual(response['Cache-Control'], 'private, no-store')

        outsider, _ = make_employer('outside-documents@example.com')
        authenticate_employer(self.client, outsider)
        denied = self.client.get(
            reverse('employer-company-document-content', kwargs={'pk': document.pk})
        )
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)

    def test_private_dpa_keeps_its_docx_type_and_extension(self):
        self._join()
        stored_name = private_media_storage().save(
            'employers/documents/candidate-dpa.docx',
            ContentFile(DOCX_BYTES),
        )
        document = CompanyDocument.objects.create(
            recruiter=self.recruiter,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
            file_url=stored_name,
            file_name='Thỏa thuận xử lý DLCN',
            mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

        with patch(
            'apps.employers.api.views.verification.render_office_document_preview',
            return_value=None,
        ):
            response = self.client.get(
                reverse('employer-company-document-content', kwargs={'pk': document.pk})
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        self.assertIn('.docx', response['Content-Disposition'])

        with patch(
            'apps.employers.api.views.verification.render_office_document_preview',
            return_value=b'%PDF-private-preview',
        ):
            preview = self.client.get(
                reverse('employer-company-document-content', kwargs={'pk': document.pk})
            )

        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertEqual(preview['Content-Type'], 'application/pdf')
        self.assertEqual(b''.join(preview.streaming_content), b'%PDF-private-preview')

    @patch('apps.employers.services.document_preview.subprocess.run')
    def test_raw_word_agreement_preview_requires_scan_without_running_office(self, soffice_run):
        upload = SimpleUploadedFile(
            'thoa-thuan.docx',
            DOCX_BYTES,
            content_type='application/octet-stream',
        )

        response = self.client.post(
            reverse('employer-company-document-upload-preview'),
            {'file': upload},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'UPLOAD_SCAN_REQUIRED')
        self.assertIn('quét an toàn', response.data['message'])
        soffice_run.assert_not_called()
        self.assertFalse(CompanyDocument.objects.filter(recruiter=self.recruiter).exists())


class CompanyUpdateRequestTests(APITestCase):
    def setUp(self):
        self.user, self.recruiter = make_employer()
        self.industry = Industry.objects.create(name='Công nghệ thông tin')
        authenticate_employer(self.client, self.user)
        self.client.post(
            reverse('employer-company-create'), company_payload(self.industry), format='json'
        )
        self.recruiter.refresh_from_db()
        self.company = self.recruiter.company

    def test_sensitive_change_requires_reason_and_proof(self):
        response = self.client.post(
            reverse('employer-company-update-requests'),
            {
                'changes': {'company_name': 'Acme Global'},
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reason', response.data)

    def test_repeated_submit_updates_the_same_pending_request(self):
        payload = {'changes': {'website_url': 'https://example.com/abc'}}
        first = self.client.post(
            reverse('employer-company-update-requests'), payload, format='json'
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        second = self.client.post(
            reverse('employer-company-update-requests'),
            {'changes': {'website_url': 'https://example.com/def'}},
            format='json',
        )
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.data)
        self.assertEqual(second.data['public_id'], first.data['public_id'])
        self.assertEqual(second.data['revision'], 2)
        self.assertEqual(
            CompanyUpdateRequest.objects.filter(company=self.company).count(),
            1,
        )
        self.assertEqual(
            second.data['changes']['website_url'],
            'https://example.com/def',
        )
        self.company.refresh_from_db()
        self.assertNotEqual(self.company.website_url, 'https://example.com/def')

    def test_linked_member_can_create_update_request_without_mfa(self):
        member_user, member = make_employer('member-update@example.com')
        member_user.two_factor_enabled = False
        member_user.save(update_fields=['two_factor_enabled'])
        member.company = self.company
        member.company_role = RecruiterProfile.CompanyRole.MEMBER
        member.save(update_fields=['company', 'company_role', 'updated_at'])
        authenticate_employer(self.client, member_user)

        response = self.client.post(
            reverse('employer-company-update-requests'),
            {
                'changes': {'address': 'Đà Nẵng'},
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], CompanyUpdateRequest.Status.SUBMITTED)

    def test_members_keep_independent_pending_requests_and_requester_is_immutable(self):
        owner_response = self.client.post(
            reverse('employer-company-update-requests'),
            {'changes': {'website_url': 'https://owner.example.com'}},
            format='json',
        )
        member_user, member = make_employer('independent-member@example.com')
        member_user.full_name = 'Nguyễn Minh Anh'
        member_user.save(update_fields=['full_name'])
        member.company = self.company
        member.company_role = RecruiterProfile.CompanyRole.MEMBER
        member.save(update_fields=['company', 'company_role', 'updated_at'])
        authenticate_employer(self.client, member_user)

        member_response = self.client.post(
            reverse('employer-company-update-requests'),
            {'changes': {'address': 'Đà Nẵng'}},
            format='json',
        )
        member_update = self.client.post(
            reverse('employer-company-update-requests'),
            {'changes': {'address': 'Huế'}},
            format='json',
        )
        mine = self.client.get(reverse('employer-company-update-requests'), {'scope': 'mine'})
        company = self.client.get(reverse('employer-company-update-requests'))

        self.assertEqual(owner_response.status_code, status.HTTP_201_CREATED, owner_response.data)
        self.assertEqual(member_response.status_code, status.HTTP_201_CREATED, member_response.data)
        self.assertEqual(member_update.status_code, status.HTTP_200_OK, member_update.data)
        self.assertNotEqual(owner_response.data['public_id'], member_response.data['public_id'])
        self.assertEqual(member_update.data['public_id'], member_response.data['public_id'])
        owner_request = CompanyUpdateRequest.objects.get(public_id=owner_response.data['public_id'])
        member_request = CompanyUpdateRequest.objects.get(
            public_id=member_response.data['public_id']
        )
        self.assertEqual(owner_request.requested_by, self.user)
        self.assertEqual(owner_request.changes['website_url'], 'https://owner.example.com')
        self.assertEqual(member_request.requested_by, member_user)
        self.assertEqual(member_request.changes['address'], 'Huế')
        self.assertIsNotNone(member_request.submitted_at)
        self.assertEqual([item['public_id'] for item in mine.data], [member_request.public_id])
        self.assertEqual(len(company.data), 2)
        summary = mine.data[0]['requested_by_summary']
        self.assertEqual(summary['public_id'], member_user.public_id)
        self.assertEqual(summary['display_name'], 'Nguyễn Minh Anh')
        self.assertNotIn('email', summary)
        owner_summary = next(
            item['requested_by_summary']
            for item in company.data
            if item['requested_by_summary']['public_id'] == self.user.public_id
        )
        self.assertEqual(owner_summary['display_name'], 'Thành viên công ty')

    def test_company_history_redacts_other_members_private_files_and_media(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.user,
            changes={
                'logo_url': 'employers/private/staged-logo.png',
                'gallery_additions': ['employers/private/staged-office.png'],
            },
            submitted_at=timezone.now(),
        )
        document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.recruiter,
            uploaded_by=self.user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/private/business-registration.pdf',
            file_name='mst-0101234567.pdf',
            mime_type='application/pdf',
            file_size=1234,
        )
        member_user, member = make_employer('history-member@example.com')
        member.company = self.company
        member.company_role = RecruiterProfile.CompanyRole.MEMBER
        member.save(update_fields=['company', 'company_role', 'updated_at'])
        authenticate_employer(self.client, member_user)

        history = self.client.get(
            reverse('employer-company-update-requests'),
            {'scope': 'company'},
        )
        with patch('apps.employers.api.views.verification.private_media_storage') as storage:
            content = self.client.get(
                reverse('employer-company-document-content', kwargs={'pk': document.pk})
            )

        self.assertEqual(history.status_code, status.HTTP_200_OK, history.data)
        item = history.data[0]
        self.assertIsNone(item['changes']['logo_url'])
        self.assertEqual(item['changes']['gallery_additions'], [])
        self.assertEqual(item['media_previews'], {})
        self.assertIsNone(item['documents'][0]['file_url'])
        self.assertEqual(item['documents'][0]['file_name'], '')
        self.assertEqual(item['documents'][0]['mime_type'], '')
        self.assertEqual(item['documents'][0]['file_size'], 0)
        self.assertEqual(content.status_code, status.HTTP_404_NOT_FOUND)
        storage.assert_not_called()

        authenticate_employer(self.client, self.user)
        owner_history = self.client.get(
            reverse('employer-company-update-requests'),
            {'scope': 'company'},
        )
        owner_item = owner_history.data[0]
        self.assertEqual(owner_item['changes']['logo_url'], 'employers/private/staged-logo.png')
        self.assertIn(
            '/media/employers/private/staged-logo.png', owner_item['media_previews']['logo_url']
        )
        self.assertIsNotNone(owner_item['documents'][0]['file_url'])

    def test_company_owner_can_open_a_members_private_document(self):
        member_user, member = make_employer('owner-readable-member@example.com')
        member.company = self.company
        member.company_role = RecruiterProfile.CompanyRole.MEMBER
        member.save(update_fields=['company', 'company_role', 'updated_at'])
        document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=member,
            uploaded_by=member_user,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/private/member-registration.pdf',
            file_name='member-registration.pdf',
            mime_type='application/pdf',
        )
        authenticate_employer(self.client, self.user)

        with (
            patch('apps.employers.api.views.verification.private_media_storage') as storage,
            patch(
                'apps.employers.api.views.verification.render_office_document_preview',
                return_value=None,
            ),
        ):
            storage.return_value.open.return_value = BytesIO(PDF_BYTES)
            listed = self.client.get(reverse('employer-company-documents'))
            response = self.client.get(
                reverse('employer-company-document-content', kwargs={'pk': document.pk})
            )

        owner_document = next(
            item for item in listed.data if item['public_id'] == document.public_id
        )
        self.assertIsNotNone(owner_document['file_url'])
        self.assertEqual(owner_document['file_name'], 'member-registration.pdf')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(b''.join(response.streaming_content), PDF_BYTES)

    def test_company_document_mine_scope_excludes_members_verification_files(self):
        owner_document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.recruiter,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/private/owner-registration.pdf',
            file_name='owner-registration.pdf',
            status=CompanyDocument.Status.APPROVED,
        )
        member_user, member = make_employer('scoped-document-member@example.com')
        member.company = self.company
        member.company_role = RecruiterProfile.CompanyRole.MEMBER
        member.save(update_fields=['company', 'company_role', 'updated_at'])
        member_document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=member,
            uploaded_by=member_user,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/private/member-rejected-registration.pdf',
            file_name='member-rejected-registration.pdf',
            status=CompanyDocument.Status.REJECTED,
        )

        visible = self.client.get(reverse('employer-company-documents'))
        mine = self.client.get(reverse('employer-company-documents'), {'scope': 'mine'})

        self.assertEqual(visible.status_code, status.HTTP_200_OK, visible.data)
        self.assertSetEqual(
            {item['public_id'] for item in visible.data},
            {owner_document.public_id, member_document.public_id},
        )
        self.assertEqual(mine.status_code, status.HTTP_200_OK, mine.data)
        self.assertEqual(
            [item['public_id'] for item in mine.data],
            [owner_document.public_id],
        )

    def test_company_document_rejects_unknown_scope(self):
        response = self.client.get(
            reverse('employer-company-documents'),
            {'scope': 'unknown'},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('scope', response.data)

    def test_member_cannot_attach_document_to_another_request(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.user,
            changes={'company_name': 'Acme mới'},
            submitted_at=timezone.now(),
        )
        member_user, member = make_employer('document-write-member@example.com')
        member.company = self.company
        member.company_role = RecruiterProfile.CompanyRole.MEMBER
        member.save(update_fields=['company', 'company_role', 'updated_at'])
        authenticate_employer(self.client, member_user)

        response = self.client.post(
            reverse('employer-company-documents'),
            {
                'doc_type': CompanyDocument.DocType.BUSINESS_REGISTRATION,
                'update_request': update_request.public_id,
                'file': SimpleUploadedFile('proof.pdf', PDF_BYTES, content_type='application/pdf'),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertFalse(CompanyDocument.objects.filter(update_request=update_request).exists())

    def test_invalid_update_request_scope_is_rejected(self):
        response = self.client.get(
            reverse('employer-company-update-requests'),
            {'scope': 'unknown'},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('scope', response.data)

    def test_admin_approval_applies_changes(self):
        self.client.post(
            reverse('employer-company-update-requests'),
            {
                'changes': {'company_name': 'Acme Global', 'address': 'TP.HCM'},
                'reason': 'Đổi tên theo giấy phép mới',
                'proof_type': 'business_registration',
            },
            format='json',
        )

        admin = User.objects.create_superuser(email='admin@example.com', password='Password@123')
        update_request = CompanyUpdateRequest.objects.get(company=self.company)
        self.assertTrue(update_request.is_sensitive)
        evidence = update_request.tax_lookup_evidences.get(workflow_revision=1)
        self.assertEqual(evidence.status, CompanyTaxLookupEvidence.Status.PENDING)
        self.assertEqual(evidence.tax_code, self.company.tax_code)
        self.assertEqual(evidence.submitted_company_name, 'Acme Global')
        CompanyDocument.objects.create(
            company=self.company,
            update_request=update_request,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/documents/update-proof.pdf',
            file_name='update-proof.pdf',
            status=CompanyDocument.Status.APPROVED,
        )
        services.start_company_update_review(
            update_request,
            actor=admin,
            lock_version=update_request.lock_version,
            revision_public_id=update_request.current_revision.public_id,
        )
        services.apply_update_request(update_request, admin, approve=True)

        self.company.refresh_from_db()
        self.assertEqual(self.company.company_name, 'Acme Global')
        self.assertEqual(self.company.address, 'TP.HCM')

    def test_sensitive_update_cannot_be_approved_before_its_document(self):
        self.client.post(
            reverse('employer-company-update-requests'),
            {
                'changes': {'company_name': 'Acme Global'},
                'reason': 'Đổi tên theo giấy phép mới',
                'proof_type': 'business_registration',
            },
            format='json',
        )
        update_request = CompanyUpdateRequest.objects.get(company=self.company)
        CompanyDocument.objects.create(
            company=self.company,
            update_request=update_request,
            uploaded_by=self.user,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/documents/update-proof.pdf',
        )
        admin = User.objects.create_superuser(
            email='approval-admin@example.com',
            password='Password@123',
        )
        services.start_company_update_review(
            update_request,
            actor=admin,
            lock_version=update_request.lock_version,
            revision_public_id=update_request.current_revision.public_id,
        )

        with self.assertRaisesMessage(
            ValidationError,
            'giấy tờ chứng minh đã được duyệt',
        ):
            services.apply_update_request(update_request, admin, approve=True)

    def test_sensitive_proof_is_bound_to_update_request(self):
        create_response = self.client.post(
            reverse('employer-company-update-requests'),
            {
                'changes': {'tax_code': '0107654321'},
                'reason': 'Thay đổi đăng ký thuế',
                'proof_type': 'business_registration',
            },
            format='json',
        )
        update_request_id = create_response.data['public_id']
        media_root = tempfile.mkdtemp()
        try:
            with self.settings(MEDIA_ROOT=media_root):
                response = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.BUSINESS_REGISTRATION,
                        'update_request': update_request_id,
                        'file': SimpleUploadedFile(
                            'proof.pdf', PDF_BYTES, content_type='application/pdf'
                        ),
                    },
                    format='multipart',
                )
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['update_request'], update_request_id)

    def test_onboarding_status_reflects_progress(self):
        response = self.client.get(reverse('employer-me'))
        onboarding = response.data['onboarding']
        self.assertTrue(onboarding['phone_verified'])
        self.assertTrue(onboarding['company_linked'])
        self.assertFalse(onboarding['business_doc_submitted'])
        self.assertFalse(onboarding['verification_completed'])
        self.assertFalse(onboarding['completed'])

    def test_session_marks_employer_verified_without_requiring_first_job(self):
        now = timezone.now()
        self.user.email_verified = True
        self.user.save(update_fields=['email_verified', 'updated_at'])
        self.recruiter.registration_completed_at = now
        self.recruiter.dpa_accepted_at = now
        self.recruiter.dpa_policy_version = settings.EMPLOYER_DPA_POLICY_VERSION
        self.recruiter.dpa_document_sha256 = settings.EMPLOYER_DPA_DOCUMENT_SHA256
        self.recruiter.save(
            update_fields=[
                'registration_completed_at',
                'dpa_accepted_at',
                'dpa_policy_version',
                'dpa_document_sha256',
                'updated_at',
            ]
        )
        EmployerDpaAcceptance.objects.create(
            recruiter=self.recruiter,
            policy_version=settings.EMPLOYER_DPA_POLICY_VERSION,
            document_sha256=settings.EMPLOYER_DPA_DOCUMENT_SHA256,
            document_url=settings.EMPLOYER_DPA_DOCUMENT_URL,
        )
        category = JobCategory.objects.create(
            name='Chuyên viên tuyển dụng',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        RecruitmentNeed.objects.create(
            recruiter=self.recruiter,
            position_category=category,
            position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
            is_continuous=True,
            headcount=1,
            budget_source=RecruitmentNeed.BudgetSource.COMPANY,
            completed_at=now,
        )
        verification_case = services.get_or_create_verification_case(self.recruiter)
        for doc_type in (
            CompanyDocument.DocType.BUSINESS_REGISTRATION,
            CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        ):
            CompanyDocument.objects.create(
                company=self.company,
                recruiter=self.recruiter,
                uploaded_by=self.user,
                verification_case=verification_case,
                doc_type=doc_type,
                file_url=f'employers/documents/{doc_type}.pdf',
                file_name=f'{doc_type}.pdf',
            )

        profile = self.client.get(reverse('employer-me'))
        session = self.client.get(reverse('auth-me'))

        self.assertTrue(profile.data['onboarding']['verification_completed'])
        self.assertFalse(profile.data['onboarding']['first_job_posted'])
        self.assertFalse(profile.data['onboarding']['completed'])
        self.assertTrue(session.data['employer_verification_completed'])

    def test_business_and_candidate_dpa_documents_update_separate_steps(self):
        media_root = tempfile.mkdtemp()
        try:
            with self.settings(MEDIA_ROOT=media_root):
                business = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.BUSINESS_REGISTRATION,
                        'file': SimpleUploadedFile(
                            'gpkd.pdf', PDF_BYTES, content_type='application/pdf'
                        ),
                    },
                    format='multipart',
                )
                candidate_dpa = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                        'file': SimpleUploadedFile(
                            'dlcn.docx',
                            DOCX_BYTES,
                            content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        ),
                    },
                    format='multipart',
                )
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

        self.assertEqual(business.status_code, status.HTTP_201_CREATED, business.data)
        self.assertEqual(candidate_dpa.status_code, status.HTTP_201_CREATED, candidate_dpa.data)
        onboarding = self.client.get(reverse('employer-me')).data['onboarding']
        self.assertTrue(onboarding['business_doc_submitted'])
        self.assertTrue(onboarding['candidate_dpa_submitted'])

    def test_replacing_a_business_document_keeps_immutable_history(self):
        media_root = tempfile.mkdtemp()
        try:
            with self.settings(MEDIA_ROOT=media_root):
                first = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.BUSINESS_REGISTRATION,
                        'file': SimpleUploadedFile(
                            'gpkd-cu.pdf', PDF_BYTES, content_type='application/pdf'
                        ),
                    },
                    format='multipart',
                )
                document = CompanyDocument.objects.get(pk=first.data['id'])
                document.status = CompanyDocument.Status.REJECTED
                document.review_note = 'Tệp chưa rõ nét.'
                document.save(update_fields=['status', 'review_note'])
                replacement = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.BUSINESS_REGISTRATION,
                        'file': SimpleUploadedFile(
                            'gpkd-moi.pdf', PDF_BYTES, content_type='application/pdf'
                        ),
                    },
                    format='multipart',
                )
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(replacement.status_code, status.HTTP_201_CREATED, replacement.data)
        self.assertNotEqual(replacement.data['id'], first.data['id'])
        document.refresh_from_db()
        current = CompanyDocument.objects.get(pk=replacement.data['id'])
        self.assertEqual(document.file_name, 'gpkd-cu.pdf')
        self.assertEqual(document.status, CompanyDocument.Status.REJECTED)
        self.assertEqual(document.review_note, 'Tệp chưa rõ nét.')
        self.assertFalse(document.is_current)
        self.assertEqual(current.file_name, 'gpkd-moi.pdf')
        self.assertEqual(current.status, CompanyDocument.Status.PENDING)
        self.assertTrue(current.is_current)
        self.assertEqual(current.version, 2)
        self.assertEqual(current.supersedes, document)
        self.assertEqual(
            CompanyDocument.objects.filter(
                company=self.company,
                doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
                update_request__isnull=True,
            ).count(),
            2,
        )

    def test_switching_verification_method_retains_previous_documents_as_history(self):
        media_root = tempfile.mkdtemp()
        try:
            with self.settings(MEDIA_ROOT=media_root):
                business = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.BUSINESS_REGISTRATION,
                        'verification_method': 'business_registration',
                        'file': SimpleUploadedFile(
                            'gpkd.pdf', PDF_BYTES, content_type='application/pdf'
                        ),
                    },
                    format='multipart',
                )
                old_path = CompanyDocument.objects.get(pk=business.data['id']).file_url
                authorization = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.AUTHORIZATION_LETTER,
                        'file': SimpleUploadedFile(
                            'uy-quyen.pdf', PDF_BYTES, content_type='application/pdf'
                        ),
                    },
                    format='multipart',
                )
                with self.captureOnCommitCallbacks(execute=True):
                    identity = self.client.post(
                        reverse('employer-company-documents'),
                        {
                            'doc_type': CompanyDocument.DocType.IDENTITY_DOCUMENT,
                            'verification_method': 'authorization_and_id',
                            'file': SimpleUploadedFile(
                                'cccd.pdf', PDF_BYTES, content_type='application/pdf'
                            ),
                        },
                        format='multipart',
                    )

                remaining_documents = CompanyDocument.objects.filter(
                    company=self.company,
                    update_request__isnull=True,
                    is_current=True,
                )
                self.assertTrue(private_media_storage().exists(old_path))
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

        self.assertEqual(business.status_code, status.HTTP_201_CREATED, business.data)
        self.assertEqual(authorization.status_code, status.HTTP_201_CREATED, authorization.data)
        self.assertEqual(identity.status_code, status.HTTP_201_CREATED, identity.data)
        self.assertSetEqual(
            set(remaining_documents.values_list('doc_type', flat=True)),
            {
                CompanyDocument.DocType.AUTHORIZATION_LETTER,
                CompanyDocument.DocType.IDENTITY_DOCUMENT,
            },
        )
        self.assertTrue(
            CompanyDocument.objects.filter(
                company=self.company,
                doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
                is_current=False,
            ).exists()
        )

    def test_identity_document_accepts_multiple_current_images_but_authorization_does_not(self):
        media_root = tempfile.mkdtemp()
        try:
            with self.settings(MEDIA_ROOT=media_root):
                authorization = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.AUTHORIZATION_LETTER,
                        'file': SimpleUploadedFile(
                            'uy-quyen.pdf', PDF_BYTES, content_type='application/pdf'
                        ),
                    },
                    format='multipart',
                )
                identity_front = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.IDENTITY_DOCUMENT,
                        'verification_method': 'authorization_and_id',
                        'file': SimpleUploadedFile(
                            'cccd-mat-truoc.png', PNG_BYTES, content_type='image/png'
                        ),
                    },
                    format='multipart',
                )
                identity_back = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.IDENTITY_DOCUMENT,
                        'append': 'true',
                        'file': SimpleUploadedFile(
                            'cccd-mat-sau.png', PNG_BYTES, content_type='image/png'
                        ),
                    },
                    format='multipart',
                )
                invalid_authorization_append = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.AUTHORIZATION_LETTER,
                        'append': 'true',
                        'file': SimpleUploadedFile(
                            'uy-quyen-trang-2.png', PNG_BYTES, content_type='image/png'
                        ),
                    },
                    format='multipart',
                )
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

        self.assertEqual(authorization.status_code, status.HTTP_201_CREATED, authorization.data)
        self.assertEqual(identity_front.status_code, status.HTTP_201_CREATED, identity_front.data)
        self.assertEqual(identity_back.status_code, status.HTTP_201_CREATED, identity_back.data)
        self.assertEqual(
            invalid_authorization_append.status_code,
            status.HTTP_400_BAD_REQUEST,
            invalid_authorization_append.data,
        )
        current_identity_documents = CompanyDocument.objects.filter(
            verification_case=self.recruiter.verification_case,
            doc_type=CompanyDocument.DocType.IDENTITY_DOCUMENT,
            is_current=True,
        ).order_by('version')
        self.assertEqual(current_identity_documents.count(), 2)
        self.assertEqual(
            list(current_identity_documents.values_list('file_name', flat=True)),
            ['cccd-mat-truoc.png', 'cccd-mat-sau.png'],
        )
        self.assertTrue(
            services.verification_checks(self.recruiter.verification_case)[
                'representative_documents_submitted'
            ]
        )
        current_identity_documents.update(status=CompanyDocument.Status.APPROVED)
        CompanyDocument.objects.filter(pk=authorization.data['id']).update(
            status=CompanyDocument.Status.APPROVED
        )
        self.assertTrue(
            services.verification_checks(self.recruiter.verification_case)[
                'business_documents_approved'
            ]
        )

    def test_replacing_one_rejected_identity_keeps_other_current_files(self):
        media_root = tempfile.mkdtemp()
        try:
            with self.settings(MEDIA_ROOT=media_root):
                authorization = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.AUTHORIZATION_LETTER,
                        'file': SimpleUploadedFile(
                            'uy-quyen.pdf', PDF_BYTES, content_type='application/pdf'
                        ),
                    },
                    format='multipart',
                )
                identity_front = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.IDENTITY_DOCUMENT,
                        'verification_method': 'authorization_and_id',
                        'file': SimpleUploadedFile(
                            'cccd-mat-truoc.png', PNG_BYTES, content_type='image/png'
                        ),
                    },
                    format='multipart',
                )
                identity_back = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.IDENTITY_DOCUMENT,
                        'append': 'true',
                        'file': SimpleUploadedFile(
                            'cccd-mat-sau.png', PNG_BYTES, content_type='image/png'
                        ),
                    },
                    format='multipart',
                )
                front = CompanyDocument.objects.get(pk=identity_front.data['id'])
                back = CompanyDocument.objects.get(pk=identity_back.data['id'])
                front.status = CompanyDocument.Status.APPROVED
                front.save(update_fields=['status'])
                back.status = CompanyDocument.Status.REJECTED
                back.review_note = 'Mặt sau bị mờ.'
                back.save(update_fields=['status', 'review_note'])
                case = back.verification_case
                case.status = EmployerVerificationCase.Status.REJECTED
                case.decision_reason = back.review_note
                case.save(update_fields=['status', 'decision_reason'])

                replacement = self.client.post(
                    reverse('employer-company-documents'),
                    {
                        'doc_type': CompanyDocument.DocType.IDENTITY_DOCUMENT,
                        'replaces': back.public_id,
                        'file': SimpleUploadedFile(
                            'cccd-mat-sau-moi.png', PNG_BYTES, content_type='image/png'
                        ),
                    },
                    format='multipart',
                )
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

        self.assertEqual(authorization.status_code, status.HTTP_201_CREATED, authorization.data)
        self.assertEqual(identity_front.status_code, status.HTTP_201_CREATED, identity_front.data)
        self.assertEqual(identity_back.status_code, status.HTTP_201_CREATED, identity_back.data)
        self.assertEqual(replacement.status_code, status.HTTP_201_CREATED, replacement.data)
        front.refresh_from_db()
        back.refresh_from_db()
        replacement_document = CompanyDocument.objects.get(pk=replacement.data['id'])
        case.refresh_from_db()
        self.assertTrue(front.is_current)
        self.assertEqual(front.status, CompanyDocument.Status.APPROVED)
        self.assertFalse(back.is_current)
        self.assertTrue(replacement_document.is_current)
        self.assertEqual(replacement_document.supersedes, back)
        self.assertEqual(replacement_document.status, CompanyDocument.Status.PENDING)
        self.assertEqual(case.status, EmployerVerificationCase.Status.PENDING)
        self.assertEqual(case.decision_reason, '')

    def test_replacement_must_target_a_current_document_of_the_same_type(self):
        other_type = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.recruiter,
            uploaded_by=self.user,
            verification_case=services.get_or_create_verification_case(self.recruiter),
            doc_type=CompanyDocument.DocType.AUTHORIZATION_LETTER,
            file_url='employers/test/authorization.pdf',
            file_name='authorization.pdf',
        )

        response = self.client.post(
            reverse('employer-company-documents'),
            {
                'doc_type': CompanyDocument.DocType.IDENTITY_DOCUMENT,
                'replaces': other_type.public_id,
                'file': SimpleUploadedFile('cccd.png', PNG_BYTES, content_type='image/png'),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn('replaces', response.data)
        other_type.refresh_from_db()
        self.assertTrue(other_type.is_current)


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, ALLOWED_HOSTS=['testserver'])
class CompanyImageUploadTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.user, self.recruiter = make_employer()
        self.company = Company.objects.create(company_name='Acme', created_by=self.user)
        self.recruiter.company = self.company
        self.recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        self.recruiter.save()
        authenticate_employer(self.client, self.user)

    def test_owner_can_upload_company_logo_to_media_storage(self):
        upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(
            reverse('employer-company-logo-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('/media/employers/', response.data['logo_url'])
        self.company.refresh_from_db()
        self.assertTrue(self.company.logo_url.startswith('employers/'))
        self.assertNotIn('://', self.company.logo_url)
        self.assertFalse(self.company.has_no_logo)

    def test_owner_can_upload_company_logo_without_mfa(self):
        self.user.two_factor_enabled = False
        self.user.save(update_fields=['two_factor_enabled'])
        upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')

        response = self.client.post(
            reverse('employer-company-logo-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_gallery_rejects_the_eleventh_image(self):
        CompanyImage.objects.bulk_create(
            [
                CompanyImage(
                    company=self.company, image_url=f'employers/image-{index}.png', sort_order=index
                )
                for index in range(10)
            ]
        )
        upload = SimpleUploadedFile('extra.png', PNG_BYTES, content_type='image/png')

        response = self.client.post(
            reverse('employer-company-image-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.company.images.count(), 10)

    def test_edit_logo_is_staged_until_the_update_request_is_approved(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.user,
            changes={'logo_pending': True},
        )
        upload = SimpleUploadedFile('new-logo.png', PNG_BYTES, content_type='image/png')

        response = self.client.post(
            reverse('employer-company-logo-upload'),
            {
                'file': upload,
                'update_request': update_request.public_id,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.logo_url, '')
        update_request.refresh_from_db()
        self.assertIn('logo_url', update_request.changes)
        self.assertNotIn('logo_pending', update_request.changes)

        admin = User.objects.create_superuser(
            email='media-reviewer@example.com',
            password='Password@123',
        )
        update_request = services.start_company_update_review(
            update_request,
            actor=admin,
            lock_version=update_request.lock_version,
            revision_public_id=update_request.current_revision.public_id,
        )
        services.apply_update_request(
            update_request,
            admin,
            approve=True,
            lock_version=update_request.lock_version,
            revision_public_id=update_request.current_revision.public_id,
        )
        self.company.refresh_from_db()
        self.assertEqual(self.company.logo_url, update_request.changes['logo_url'])

    def test_pending_gallery_upload_is_returned_for_the_next_edit(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.user,
            changes={'gallery_pending': True},
        )
        upload = SimpleUploadedFile('office.png', PNG_BYTES, content_type='image/png')

        upload_response = self.client.post(
            reverse('employer-company-image-upload'),
            {
                'file': upload,
                'update_request': update_request.public_id,
            },
            format='multipart',
        )
        list_response = self.client.get(reverse('employer-company-update-requests'))

        self.assertEqual(upload_response.status_code, status.HTTP_200_OK, upload_response.data)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK, list_response.data)
        pending = next(
            item for item in list_response.data if item['public_id'] == update_request.public_id
        )
        self.assertEqual(len(pending['changes']['gallery_additions']), 1)
        self.assertEqual(len(pending['media_previews']['gallery_additions']), 1)
        self.assertIn('/media/employers/', pending['media_previews']['gallery_additions'][0])

    def test_direct_media_edit_is_blocked_after_verification_was_submitted(self):
        EmployerVerificationCase.objects.create(
            recruiter=self.recruiter,
            company=self.company,
            status=EmployerVerificationCase.Status.PENDING,
        )
        upload = SimpleUploadedFile('bypass.png', PNG_BYTES, content_type='image/png')

        response = self.client.post(
            reverse('employer-company-logo-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('update_request', response.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.logo_url, '')

    def test_member_cannot_upload_logo(self):
        member, member_recruiter = make_employer('member@example.com')
        member_recruiter.company = self.company
        member_recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        member_recruiter.save()
        authenticate_employer(self.client, member)

        upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(
            reverse('employer-company-logo-upload'), {'file': upload}, format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_cannot_mutate_media_on_a_members_update_request(self):
        member, member_recruiter = make_employer('media-request-owner@example.com')
        member_recruiter.company = self.company
        member_recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        member_recruiter.save(update_fields=['company', 'company_role', 'updated_at'])
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=member,
            changes={'logo_pending': True},
            submitted_at=timezone.now(),
        )

        response = self.client.post(
            reverse('employer-company-logo-upload'),
            {
                'file': SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png'),
                'update_request': update_request.public_id,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        update_request.refresh_from_db()
        self.assertEqual(update_request.changes, {'logo_pending': True})

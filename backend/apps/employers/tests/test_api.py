import re
import shutil
import tempfile
from datetime import timedelta

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import AuthEmailJob, User
from apps.locations.models import Location
from apps.jobs.models import JobCategory

from .. import services
from ..models import Company, CompanyDocument, CompanyUpdateRequest, Industry, PhoneOtp, RecruiterProfile, RecruitmentNeed


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
    user = User.objects.create_user(email=email, password='Password@123', role=User.Role.EMPLOYER)
    recruiter = RecruiterProfile.objects.create(user=user)
    if phone_verified:
        recruiter.verified_phone = f'09{abs(hash(email)) % 10 ** 8:08d}'
        recruiter.phone_verified_at = timezone.now()
        recruiter.save()
    return user, recruiter


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
        self.assertIn('refresh', response.data)
        self.assertTrue(response.data['user']['employer_onboarding_required'])

        user = User.objects.get(email='hr@acme.vn')
        recruiter = RecruiterProfile.objects.select_related('company', 'work_location').get(user=user)
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
        self.assertTrue(AuthEmailJob.objects.filter(
            user=user, kind=AuthEmailJob.Kind.VERIFICATION,
        ).exists())

    def test_registration_requires_mandatory_terms(self):
        response = self.client.post(
            reverse('employer-register'),
            {**self.payload, 'terms_accepted': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('terms_accepted', response.data)
        self.assertFalse(User.objects.filter(email='hr@acme.vn').exists())

    def test_registration_rejects_weak_password_and_duplicate_contact_phone(self):
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
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('contact_phone', duplicate.data)

    def test_google_employer_can_complete_registration_profile_once(self):
        user = User.objects.create_user(
            email='google@acme.vn',
            password=None,
            role=User.Role.EMPLOYER,
            email_verified=True,
        )
        self.client.force_authenticate(user=user)
        profile_payload = {key: value for key, value in self.payload.items() if key not in {
            'email', 'password', 'captcha_token',
        }}

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
        response = self.client.post(reverse('employer-consulting-need'), self.payload, format='json')

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

        repeated = self.client.post(reverse('employer-consulting-need'), self.payload, format='json')
        self.assertEqual(repeated.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('đã hoàn tất', str(repeated.data['detail']))

    def test_unverified_email_cannot_submit_consulting_need(self):
        self.user.email_verified = False
        self.user.save(update_fields=['email_verified', 'updated_at'])

        response = self.client.post(reverse('employer-consulting-need'), self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(RecruitmentNeed.objects.filter(recruiter=self.recruiter).exists())

    def test_consulting_need_rejects_non_specialization_category(self):
        domain = JobCategory.objects.create(
            name='Công nghệ',
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        response = self.client.post(reverse('employer-consulting-need'), {
            **self.payload,
            'position_category': domain.id,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('position_category', response.data)

    def test_consulting_need_rejects_past_date_and_inverted_budget(self):
        past_date = self.client.post(reverse('employer-consulting-need'), {
            **self.payload,
            'target_date': (timezone.localdate() - timedelta(days=1)).isoformat(),
        }, format='json')
        self.assertEqual(past_date.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('target_date', past_date.data)

        inverted_budget = self.client.post(reverse('employer-consulting-need'), {
            **self.payload,
            'budget_min': 20_000_000,
            'budget_max': 10_000_000,
        }, format='json')
        self.assertEqual(inverted_budget.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('budget_max', inverted_budget.data)

    def test_consulting_need_accepts_at_most_one_consultation_topic(self):
        response = self.client.post(reverse('employer-consulting-need'), {
            **self.payload,
            'consultation_topics': [
                RecruitmentNeed.ConsultationTopic.FREE_POSTING,
                RecruitmentNeed.ConsultationTopic.PROMOTIONS,
            ],
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('consultation_topics', response.data)

    def test_continuous_hiring_clears_target_date_and_budget_is_optional(self):
        response = self.client.post(reverse('employer-consulting-need'), {
            **self.payload,
            'target_date': None,
            'is_continuous': True,
            'budget_min': None,
            'budget_max': None,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIsNone(response.data['target_date'])


class PhoneOtpTests(APITestCase):
    def setUp(self):
        self.user, self.recruiter = make_employer(phone_verified=False)
        self.client.force_authenticate(user=self.user)

    def test_send_and_verify_otp_marks_phone_verified(self):
        response = self.client.post(reverse('employer-phone-send-otp'), {'phone': '0912345678'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        # Lấy mã từ nội dung email (đúng 6 chữ số liền nhau — SĐT dài 10 số nên không khớp nhầm).
        code = re.search(r'\b(\d{6})\b', mail.outbox[0].body).group(1)
        response = self.client.post(reverse('employer-phone-verify'), {'code': code})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.recruiter.refresh_from_db()
        self.assertEqual(self.recruiter.verified_phone, '0912345678')
        self.assertIsNotNone(self.recruiter.phone_verified_at)

    def test_wrong_otp_rejected_and_attempts_counted(self):
        self.client.post(reverse('employer-phone-send-otp'), {'phone': '0912345678'})
        response = self.client.post(reverse('employer-phone-verify'), {'code': '000000'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PhoneOtp.objects.get(user=self.user).attempts, 1)

    def test_phone_already_verified_by_other_recruiter_is_rejected(self):
        other_user, other = make_employer('other@example.com', phone_verified=False)
        other.verified_phone = '0912345678'
        other.phone_verified_at = timezone.now()
        other.save()

        response = self.client.post(reverse('employer-phone-send-otp'), {'phone': '0912345678'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nhà tuyển dụng khác', str(response.data['phone']))

    def test_oauth_account_without_password_must_create_password_first(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=['password', 'updated_at'])

        response = self.client.post(reverse('employer-phone-send-otp'), {'phone': '0912345678'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)


class CompanyCreateTests(APITestCase):
    def setUp(self):
        self.user, self.recruiter = make_employer()
        self.industry = Industry.objects.create(name='Công nghệ thông tin')
        self.client.force_authenticate(user=self.user)

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
        self.assertEqual(self.recruiter.membership_status, RecruiterProfile.MembershipStatus.APPROVED)
        self.assertTrue(company.company_industries.get(industry=self.industry).is_primary)

    def test_create_requires_verified_phone(self):
        user, _ = make_employer('newbie@example.com', phone_verified=False)
        self.client.force_authenticate(user=user)
        response = self.client.post(
            reverse('employer-company-create'), company_payload(self.industry), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_primary_industry_must_be_among_selected(self):
        other = Industry.objects.create(name='Bảo hiểm')
        payload = company_payload(self.industry, primary_industry=other.id)
        response = self.client.post(reverse('employer-company-create'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_change_company_once_linked(self):
        self.client.post(reverse('employer-company-create'), company_payload(self.industry), format='json')
        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry, tax_code='0207654321'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_tax_code_rejected(self):
        self.client.post(reverse('employer-company-create'), company_payload(self.industry), format='json')
        user2, _ = make_employer('hr2@example.com')
        self.client.force_authenticate(user=user2)
        response = self.client.post(
            reverse('employer-company-create'),
            company_payload(self.industry, company_name='Acme Fake'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_placeholder_does_not_block_explicit_company_creation(self):
        placeholder = Company.objects.create(
            company_name='Tên khai báo ban đầu',
            has_no_logo=True,
            has_no_website=True,
            created_by=self.user,
        )
        self.recruiter.company = placeholder
        self.recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        self.recruiter.membership_status = RecruiterProfile.MembershipStatus.APPROVED
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
        self.client.force_authenticate(user=self.user)

    def _join_with_business_registration(self):
        upload = SimpleUploadedFile('gdkd.png', PNG_BYTES, content_type='image/png')
        return self.client.post(reverse('employer-company-join'), {
            'company': self.company.public_id,
            'proof_type': 'business_registration',
            'business_registration_file': upload,
        }, format='multipart')

    def test_search_finds_company_by_name_and_tax_code(self):
        for q in ['Acme', '0101234567']:
            response = self.client.get(reverse('employer-company-search'), {'q': q})
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data['results'][0]['public_id'], self.company.public_id)

    def test_join_with_business_registration_creates_pending_membership(self):
        response = self._join_with_business_registration()
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.recruiter.refresh_from_db()
        self.assertEqual(self.recruiter.company, self.company)
        self.assertEqual(self.recruiter.membership_status, RecruiterProfile.MembershipStatus.PENDING)
        self.assertTrue(self.company.documents.filter(
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION, uploaded_by=self.user,
        ).exists())

    def test_join_with_authorization_requires_both_files(self):
        response = self.client.post(reverse('employer-company-join'), {
            'company': self.company.public_id,
            'proof_type': 'authorization_and_id',
            'authorization_file': SimpleUploadedFile('uyquyen.png', PNG_BYTES, content_type='image/png'),
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pending_member_cannot_post_job(self):
        self._join_with_business_registration()
        response = self.client.post(reverse('employer-job-list-create'), {
            'title': 'Nhân viên kinh doanh', 'description': 'Mô tả',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('chờ duyệt', str(response.data))

    def test_admin_approves_membership(self):
        self._join_with_business_registration()

        admin = User.objects.create_superuser(email='admin@example.com', password='Password@123')
        self.recruiter.refresh_from_db()
        services.review_membership(self.recruiter, admin, approve=True)
        self.recruiter.refresh_from_db()
        self.assertEqual(self.recruiter.membership_status, RecruiterProfile.MembershipStatus.APPROVED)


class CompanyUpdateRequestTests(APITestCase):
    def setUp(self):
        self.user, self.recruiter = make_employer()
        self.industry = Industry.objects.create(name='Công nghệ thông tin')
        self.client.force_authenticate(user=self.user)
        self.client.post(reverse('employer-company-create'), company_payload(self.industry), format='json')
        self.recruiter.refresh_from_db()
        self.company = self.recruiter.company

    def test_sensitive_change_requires_reason_and_proof(self):
        response = self.client.post(reverse('employer-company-update-requests'), {
            'changes': {'company_name': 'Acme Global'},
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reason', response.data)

    def test_only_one_pending_request_per_company(self):
        payload = {'changes': {'address': 'TP.HCM'}}
        first = self.client.post(reverse('employer-company-update-requests'), payload, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        second = self.client.post(reverse('employer-company-update-requests'), payload, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_approval_applies_changes(self):
        self.client.post(reverse('employer-company-update-requests'), {
            'changes': {'company_name': 'Acme Global', 'address': 'TP.HCM'},
            'reason': 'Đổi tên theo giấy phép mới',
            'proof_type': 'business_registration',
        }, format='json')

        admin = User.objects.create_superuser(email='admin@example.com', password='Password@123')
        update_request = CompanyUpdateRequest.objects.get(company=self.company)
        self.assertTrue(update_request.is_sensitive)
        services.apply_update_request(update_request, admin, approve=True)

        self.company.refresh_from_db()
        self.assertEqual(self.company.company_name, 'Acme Global')
        self.assertEqual(self.company.address, 'TP.HCM')

    def test_onboarding_status_reflects_progress(self):
        response = self.client.get(reverse('employer-me'))
        onboarding = response.data['onboarding']
        self.assertTrue(onboarding['phone_verified'])
        self.assertTrue(onboarding['company_linked'])
        self.assertTrue(onboarding['membership_approved'])
        self.assertFalse(onboarding['business_doc_submitted'])
        self.assertFalse(onboarding['completed'])

    def test_business_and_candidate_dpa_documents_update_separate_steps(self):
        media_root = tempfile.mkdtemp()
        try:
            with self.settings(MEDIA_ROOT=media_root):
                business = self.client.post(reverse('employer-company-documents'), {
                    'doc_type': CompanyDocument.DocType.BUSINESS_REGISTRATION,
                    'file': SimpleUploadedFile('gpkd.pdf', PDF_BYTES, content_type='application/pdf'),
                }, format='multipart')
                candidate_dpa = self.client.post(reverse('employer-company-documents'), {
                    'doc_type': CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
                    'file': SimpleUploadedFile(
                        'dlcn.docx',
                        DOCX_BYTES,
                        content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    ),
                }, format='multipart')
        finally:
            shutil.rmtree(media_root, ignore_errors=True)

        self.assertEqual(business.status_code, status.HTTP_201_CREATED, business.data)
        self.assertEqual(candidate_dpa.status_code, status.HTTP_201_CREATED, candidate_dpa.data)
        onboarding = self.client.get(reverse('employer-me')).data['onboarding']
        self.assertTrue(onboarding['business_doc_submitted'])
        self.assertTrue(onboarding['candidate_dpa_submitted'])


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
        self.recruiter.membership_status = RecruiterProfile.MembershipStatus.APPROVED
        self.recruiter.save()
        self.client.force_authenticate(user=self.user)

    def test_owner_can_upload_company_logo_to_media_storage(self):
        upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(reverse('employer-company-logo-upload'), {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('/media/employers/', response.data['logo_url'])
        self.company.refresh_from_db()
        self.assertTrue(self.company.logo_url.startswith('employers/'))
        self.assertNotIn('://', self.company.logo_url)

    def test_member_cannot_upload_logo(self):
        member, member_recruiter = make_employer('member@example.com')
        member_recruiter.company = self.company
        member_recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        member_recruiter.membership_status = RecruiterProfile.MembershipStatus.APPROVED
        member_recruiter.save()
        self.client.force_authenticate(user=member)

        upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(reverse('employer-company-logo-upload'), {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

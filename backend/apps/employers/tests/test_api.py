import re
import shutil
import tempfile

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from .. import services
from ..models import Company, CompanyDocument, CompanyUpdateRequest, Industry, PhoneOtp, RecruiterProfile


PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
    b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
    b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
    b'\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)
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

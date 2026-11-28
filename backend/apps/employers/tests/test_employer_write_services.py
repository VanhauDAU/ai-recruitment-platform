"""Write services that used to live in employer views and serializers."""

import shutil
import tempfile
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.test import APITestCase

from apps.accounts.models import User

from ..api.permissions import require_company_recruiter
from ..domain.page_content import GALLERY_LIMIT
from ..models import (
    Company,
    CompanyDocument,
    CompanyImage,
    CompanyUpdateRequest,
    EmployerNotification,
    EmployerVerificationCase,
    Industry,
    RecruiterProfile,
)
from ..selectors import existing_recruiter_profile
from ..services import (
    create_company_for_recruiter,
    create_recruitment_need,
    emit_employer_event,
    mark_employer_notification_read,
    remove_company_image,
    save_company_document,
    save_company_image,
    save_company_website_proof,
    submit_validated_company_update,
)
from .factories import PDF_BYTES, PNG_BYTES, make_recruiter, pdf_bytes

TEST_MEDIA_ROOT = tempfile.mkdtemp()


def _png(name='logo.png'):
    return SimpleUploadedFile(name, PNG_BYTES, content_type='image/png')


class _CompanyOwnerTestCase(TestCase):
    def setUp(self):
        self.user, self.recruiter = make_recruiter('owner-services@example.com')
        self.company = Company.objects.create(
            company_name='Acme Services', tax_code='0109876543', created_by=self.user
        )
        self.recruiter.company = self.company
        self.recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        self.recruiter.save(update_fields=['company', 'company_role', 'updated_at'])

    def _update_request(self, **changes):
        return CompanyUpdateRequest.objects.create(
            company=self.company, requested_by=self.user, changes=changes
        )


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class CompanyMediaServiceTests(_CompanyOwnerTestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def test_logo_is_published_directly_before_any_request(self):
        self.company.has_no_logo = True
        self.company.save(update_fields=['has_no_logo'])

        company, update_request = save_company_image(
            user=self.user, company=self.company, kind='logo', upload=_png()
        )

        self.assertIsNone(update_request)
        company.refresh_from_db()
        self.assertTrue(company.logo_url.startswith(f'employers/{company.public_id}/logos/'))
        self.assertFalse(company.has_no_logo)

    def test_gallery_is_capped_when_publishing_directly(self):
        CompanyImage.objects.bulk_create(
            CompanyImage(company=self.company, image_url=f'gallery/{index}.png', sort_order=index)
            for index in range(GALLERY_LIMIT)
        )

        with self.assertRaises(ValidationError) as raised:
            save_company_image(user=self.user, company=self.company, kind='gallery', upload=_png())

        self.assertIn('file', raised.exception.detail)
        self.assertEqual(self.company.images.count(), GALLERY_LIMIT)

    def test_staged_image_goes_into_the_request_and_leaves_the_company(self):
        update_request = self._update_request(logo_pending=True)

        company, staged = save_company_image(
            user=self.user,
            company=self.company,
            kind='logo',
            update_request=update_request,
            upload=_png(),
        )

        self.assertEqual(staged.pk, update_request.pk)
        self.assertNotIn('logo_pending', staged.changes)
        self.assertFalse(staged.changes['has_no_logo'])
        self.assertTrue(staged.changes['logo_url'].startswith('employers/'))
        company.refresh_from_db()
        self.assertEqual(company.logo_url, '')

    def test_removing_a_staged_logo_marks_the_request_logo_less(self):
        update_request = self._update_request(logo_url='employers/x/logos/old.png')

        _, staged = remove_company_image(
            user=self.user, company=self.company, kind='logo', update_request=update_request
        )

        self.assertNotIn('logo_url', staged.changes)
        self.assertTrue(staged.changes['has_no_logo'])

    def test_closed_request_rejects_staging(self):
        update_request = self._update_request()
        CompanyUpdateRequest.objects.filter(pk=update_request.pk).update(
            status=CompanyUpdateRequest.Status.APPROVED
        )

        with self.assertRaises(ValidationError):
            remove_company_image(
                user=self.user, company=self.company, kind='cover', update_request=update_request
            )


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class CompanyDocumentServiceTests(_CompanyOwnerTestCase):
    def test_website_proof_supersedes_the_requests_current_proof(self):
        update_request = self._update_request(trade_name='Acme')
        first = save_company_website_proof(
            user=self.user,
            recruiter=self.recruiter,
            website_url='https://acme.vn',
            update_request=update_request,
        )

        second = save_company_website_proof(
            user=self.user,
            recruiter=self.recruiter,
            website_url='https://acme.vn/about',
            update_request=update_request,
        )

        first.refresh_from_db()
        self.assertFalse(first.is_current)
        self.assertEqual(second.supersedes_id, first.pk)
        self.assertEqual(second.version, 2)
        self.assertEqual(second.doc_type, CompanyDocument.DocType.TRADE_NAME_PROOF)

    def test_website_proof_rejects_someone_elses_request(self):
        other_user, other = make_recruiter('other-services@example.com')
        other.company = self.company
        other.save(update_fields=['company', 'updated_at'])
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company, requested_by=other_user, changes={}
        )

        with self.assertRaises(ValidationError):
            save_company_website_proof(
                user=self.user,
                recruiter=self.recruiter,
                website_url='https://acme.vn',
                update_request=update_request,
            )

    def test_choosing_a_verification_method_retires_the_other_methods_proof(self):
        def upload(doc_type, method):
            return save_company_document(
                user=self.user,
                recruiter=self.recruiter,
                company=self.company,
                doc_type=doc_type,
                upload=SimpleUploadedFile('proof.pdf', PDF_BYTES, content_type='application/pdf'),
                verification_method=method,
            )

        identity = upload(CompanyDocument.DocType.IDENTITY_DOCUMENT, 'authorization_and_id')
        registration = upload(
            CompanyDocument.DocType.BUSINESS_REGISTRATION, 'business_registration'
        )

        identity.refresh_from_db()
        self.assertFalse(identity.is_current)
        self.assertTrue(registration.is_current)
        self.assertEqual(
            registration.verification_case,
            EmployerVerificationCase.objects.get(recruiter=self.recruiter),
        )


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class LegacyDocumentUploadStructureTests(_CompanyOwnerTestCase):
    """Multipart trực tiếp (không qua phiên quét) vẫn phải qua kiểm cấu trúc."""

    def _save(self, name, payload, content_type, doc_type=None):
        return save_company_document(
            user=self.user,
            recruiter=self.recruiter,
            company=self.company,
            doc_type=doc_type or CompanyDocument.DocType.BUSINESS_REGISTRATION,
            upload=SimpleUploadedFile(name, payload, content_type=content_type),
        )

    def assertRejected(self, *args, **kwargs):
        with self.assertRaises(ValidationError) as raised:
            self._save(*args, **kwargs)
        self.assertIn('file', raised.exception.detail)
        self.assertFalse(CompanyDocument.objects.filter(company=self.company).exists())

    def test_encrypted_pdf_is_rejected(self):
        self.assertRejected('gpkd.pdf', pdf_bytes(password='secret'), 'application/pdf')

    def test_pdf_with_more_than_fifty_pages_is_rejected(self):
        self.assertRejected('gpkd.pdf', pdf_bytes(pages=51), 'application/pdf')

    def test_pdf_with_fifty_pages_is_accepted(self):
        document = self._save('gpkd.pdf', pdf_bytes(pages=50), 'application/pdf')

        self.assertTrue(document.is_current)

    def test_corrupt_png_is_rejected(self):
        self.assertRejected('gpkd.png', PNG_BYTES[:40], 'image/png')

    def test_legacy_word_document_is_rejected_for_the_dpa(self):
        ole2 = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1' + b'\x00' * 512
        self.assertRejected(
            'thoa-thuan.doc',
            ole2,
            'application/msword',
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        )

    def test_zip_bomb_docx_is_rejected_for_the_dpa(self):
        bomb = BytesIO()
        with ZipFile(bomb, 'w', compression=ZIP_DEFLATED) as archive:
            archive.writestr('[Content_Types].xml', b'<Types/>')
            archive.writestr('word/document.xml', b'0' * (2 * 1024 * 1024))
        self.assertRejected(
            'thoa-thuan.docx',
            bomb.getvalue(),
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        )


class CompanyCreationServiceTests(TestCase):
    def test_creator_owns_the_new_company_with_its_industries(self):
        user, recruiter = make_recruiter('creator-services@example.com')
        primary = Industry.objects.create(name='Dịch vụ thử nghiệm A')
        secondary = Industry.objects.create(name='Dịch vụ thử nghiệm B')

        company = create_company_for_recruiter(
            user,
            {
                'company_name': 'Nova',
                'tax_code': '0105550000',
                'industries': [primary, secondary],
                'primary_industry': primary,
                'logo_pending': True,
            },
        )

        recruiter.refresh_from_db()
        self.assertEqual(company.created_by, user)
        self.assertEqual(recruiter.company, company)
        self.assertEqual(recruiter.company_role, RecruiterProfile.CompanyRole.OWNER)
        self.assertEqual(
            {(item.industry_id, item.is_primary) for item in company.company_industries.all()},
            {(primary.pk, True), (secondary.pk, False)},
        )


class CompanyUpdateSubmissionServiceTests(_CompanyOwnerTestCase):
    def test_validation_sees_the_locked_open_request(self):
        open_request = self._update_request(company_name='Acme cũ')
        seen = []

        def validate(company, active_request):
            seen.append((company.pk, active_request.pk))
            return {'changes': {'company_name': 'Acme mới'}, 'reason': 'Đổi tên'}

        update_request, created = submit_validated_company_update(
            company_id=self.company.pk, requester=self.user, validate=validate
        )

        self.assertEqual(seen, [(self.company.pk, open_request.pk)])
        self.assertFalse(created)
        self.assertEqual(update_request.changes['company_name'], 'Acme mới')


class NotificationServiceTests(TestCase):
    def test_read_is_scoped_to_the_recipient_and_keeps_the_first_read_time(self):
        user, _ = make_recruiter('notified-services@example.com')
        other, _ = make_recruiter('stranger-services@example.com')
        notification, _ = emit_employer_event(
            recipient=user,
            event_type=EmployerNotification.EventType.VERIFICATION_APPROVED,
            dedupe_key='services:read',
            message='Đã duyệt.',
        )

        self.assertIsNone(mark_employer_notification_read(other, notification.public_id))
        first = mark_employer_notification_read(user, notification.public_id)
        again = mark_employer_notification_read(user, notification.public_id)

        self.assertIsNotNone(first.read_at)
        self.assertEqual(again.read_at, first.read_at)


class RecruitmentNeedServiceTests(TestCase):
    def test_need_counts_as_completed_when_created(self):
        from apps.jobs.models import JobCategory

        _, recruiter = make_recruiter('need-services@example.com')
        category = JobCategory.objects.create(
            name='Lập trình viên',
            slug='lap-trinh-vien-services',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )

        need = create_recruitment_need(
            recruiter=recruiter,
            validated_data={
                'position_category': category,
                'position_level': 'staff',
                'is_continuous': True,
                'headcount': 2,
            },
        )

        self.assertIsNotNone(need.completed_at)
        self.assertEqual(need.recruiter, recruiter)


class ReadPathsDoNotCreateProfilesTests(APITestCase):
    """GET endpoints answer for a profile-less employer without inserting one."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='no-profile@example.com', password='Password@123', role=User.Role.EMPLOYER
        )
        self.client.force_authenticate(self.user)

    def test_reads_answer_as_before_without_writing(self):
        self.assertEqual(self.client.get(reverse('employer-recruitment-needs')).data, [])
        self.assertEqual(self.client.get(reverse('employer-company-documents')).data, [])
        self.assertEqual(self.client.get(reverse('employer-company')).status_code, 404)
        self.assertEqual(self.client.get(reverse('employer-company-members')).status_code, 403)

        self.assertIsNone(existing_recruiter_profile(self.user))

    def test_company_check_reports_a_missing_link_without_creating_a_profile(self):
        with self.assertRaises(NotFound):
            require_company_recruiter(self.user)

        self.assertFalse(RecruiterProfile.objects.filter(user=self.user).exists())

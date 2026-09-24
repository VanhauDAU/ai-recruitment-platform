from io import BytesIO

from django.core.files.storage import storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from pypdf import PdfWriter
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.accounts.services.tokens import issue_tokens
from apps.uploads.models import UploadAsset
from apps.uploads.services import (
    create_upload_session,
    process_upload_scan,
    store_quarantined_upload,
)
from apps.uploads.tests.fakes import FakeUploadScanner
from apps.uploads.tests.helpers import TemporaryUploadStorageMixin, pdf_upload

from ..models import (
    Company,
    CompanyDocument,
    CompanyMediaUpload,
    RecruiterProfile,
)

PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
    b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
    b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
    b'\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)


def valid_pdf_bytes():
    output = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.write(output)
    return output.getvalue()


VALID_PDF_BYTES = valid_pdf_bytes()


class EmployerDocumentUploadSessionTests(TemporaryUploadStorageMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            email='employer-upload-session@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            two_factor_enabled=True,
        )
        self.company = Company.objects.create(
            company_name='Upload Session Company',
            tax_code='0109999999',
            created_by=self.user,
        )
        self.recruiter = RecruiterProfile.objects.create(
            user=self.user,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
        )
        tokens = issue_tokens(self.user, auth_method='mfa')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')

    def create_session(
        self,
        *,
        owner=None,
        purpose='employer_verification',
        clean=True,
        payload=VALID_PDF_BYTES,
    ):
        owner = owner or self.user
        session = create_upload_session(
            owner=owner,
            purpose=purpose,
            original_filename='registration.pdf',
            content_type='application/pdf',
            expected_size_bytes=len(payload),
        )
        session = store_quarantined_upload(
            owner=owner,
            public_id=session.public_id,
            upload=pdf_upload(payload, name='registration.pdf'),
        )
        if clean:
            process_upload_scan(session.pk, scanner=FakeUploadScanner())
        return session

    def submit_session(self, session):
        return self.client.post(
            reverse('employer-company-documents'),
            {
                'doc_type': CompanyDocument.DocType.BUSINESS_REGISTRATION,
                'upload_session': session.public_id,
            },
            format='json',
        )

    def test_clean_owned_session_is_claimed_and_attached_to_private_document(self):
        session = self.create_session()

        response = self.submit_session(session)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        document = CompanyDocument.objects.get(public_id=response.data['public_id'])
        asset = UploadAsset.objects.get(source_session=session)
        self.assertEqual(document.upload_asset, asset)
        self.assertEqual(document.file_url, asset.storage_key)
        self.assertEqual(document.sha256, asset.checksum_sha256)
        self.assertEqual(asset.claim_scope, 'employer_document')
        self.assertEqual(asset.claim_reference, document.public_id)
        self.assertTrue(storages['private_media'].exists(document.file_url))

    def test_session_must_be_clean_before_document_is_created(self):
        session = self.create_session(clean=False)

        response = self.submit_session(session)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.data)
        self.assertEqual(response.data['code'], 'UPLOAD_NOT_CLEAN')
        self.assertFalse(CompanyDocument.objects.exists())

    def test_session_purpose_is_bound_to_the_document_workflow(self):
        session = self.create_session(purpose='employer_company_update')

        response = self.submit_session(session)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.data)
        self.assertEqual(response.data['code'], 'UPLOAD_PURPOSE_MISMATCH')
        self.assertFalse(CompanyDocument.objects.exists())

    def test_malware_clean_but_structurally_invalid_pdf_is_rejected(self):
        session = self.create_session(payload=b'%PDF-not-a-valid-document')

        response = self.submit_session(session)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn('Nội dung tệp bị lỗi', str(response.data))
        asset = UploadAsset.objects.get(source_session=session)
        self.assertIsNone(asset.claimed_at)
        self.assertFalse(CompanyDocument.objects.exists())

    def test_another_owner_session_is_not_disclosed(self):
        other_user = User.objects.create_user(
            email='other-upload-session@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        session = self.create_session(owner=other_user)

        response = self.submit_session(session)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND, response.data)
        self.assertEqual(response.data['code'], 'RESOURCE_NOT_FOUND')
        self.assertFalse(CompanyDocument.objects.exists())

    def test_one_clean_session_cannot_be_attached_to_two_documents(self):
        session = self.create_session()
        first = self.submit_session(session)

        second = self.submit_session(session)

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT, second.data)
        self.assertEqual(second.data['code'], 'UPLOAD_ALREADY_SUBMITTED')
        self.assertEqual(CompanyDocument.objects.count(), 1)

    def test_strict_mode_rejects_legacy_raw_upload(self):
        with self.settings(EMPLOYER_UPLOAD_SESSION_REQUIRED=True):
            response = self.client.post(
                reverse('employer-company-documents'),
                {
                    'doc_type': CompanyDocument.DocType.BUSINESS_REGISTRATION,
                    'file': pdf_upload(VALID_PDF_BYTES, name='registration.pdf'),
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.data)
        self.assertEqual(response.data['code'], 'UPLOAD_SESSION_REQUIRED')
        self.assertFalse(CompanyDocument.objects.exists())


class EmployerMediaUploadSessionTests(TemporaryUploadStorageMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            email='employer-media-session@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            two_factor_enabled=True,
        )
        self.company = Company.objects.create(
            company_name='Media Session Company',
            tax_code='0108888888',
            created_by=self.user,
        )
        RecruiterProfile.objects.create(
            user=self.user,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
        )
        tokens = issue_tokens(self.user, auth_method='mfa')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')

    def create_image_session(
        self,
        *,
        clean=True,
        purpose='employer_company_update',
        payload=PNG_BYTES,
    ):
        session = create_upload_session(
            owner=self.user,
            purpose=purpose,
            original_filename='logo.png',
            content_type='image/png',
            expected_size_bytes=len(payload),
        )
        session = store_quarantined_upload(
            owner=self.user,
            public_id=session.public_id,
            upload=SimpleUploadedFile('logo.png', payload, content_type='image/png'),
        )
        if clean:
            process_upload_scan(session.pk, scanner=FakeUploadScanner())
        return session

    def test_clean_image_session_creates_public_derivative_and_private_audit_link(self):
        session = self.create_image_session()

        response = self.client.post(
            reverse('employer-company-logo-upload'),
            {'upload_session': session.public_id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.company.refresh_from_db()
        record = CompanyMediaUpload.objects.get(company=self.company)
        asset = UploadAsset.objects.get(source_session=session)
        self.assertEqual(record.upload_asset, asset)
        self.assertEqual(record.kind, CompanyMediaUpload.Kind.LOGO)
        self.assertEqual(record.public_path, self.company.logo_url)
        self.assertEqual(asset.claim_scope, 'employer_company_media')
        self.assertEqual(asset.claim_reference, record.public_id)
        self.assertTrue(storages['private_media'].exists(asset.storage_key))
        self.assertTrue(storages['public_media'].exists(record.public_path))

    def test_unscanned_image_session_is_not_published(self):
        session = self.create_image_session(clean=False)

        response = self.client.post(
            reverse('employer-company-logo-upload'),
            {'upload_session': session.public_id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.data)
        self.assertEqual(response.data['code'], 'UPLOAD_NOT_CLEAN')
        self.company.refresh_from_db()
        self.assertEqual(self.company.logo_url, '')
        self.assertFalse(CompanyMediaUpload.objects.exists())

    def test_media_session_rejects_a_verification_document_purpose(self):
        session = self.create_image_session(purpose='employer_verification')

        response = self.client.post(
            reverse('employer-company-logo-upload'),
            {'upload_session': session.public_id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.data)
        self.assertEqual(response.data['code'], 'UPLOAD_PURPOSE_MISMATCH')
        self.assertFalse(CompanyMediaUpload.objects.exists())

    def test_malware_clean_but_invalid_image_is_not_published(self):
        session = self.create_image_session(payload=b'\x89PNG\r\n\x1a\ninvalid')

        response = self.client.post(
            reverse('employer-company-logo-upload'),
            {'upload_session': session.public_id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        asset = UploadAsset.objects.get(source_session=session)
        self.assertIsNone(asset.claimed_at)
        self.assertFalse(CompanyMediaUpload.objects.exists())
        self.company.refresh_from_db()
        self.assertEqual(self.company.logo_url, '')

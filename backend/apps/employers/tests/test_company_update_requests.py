"""Recruiter company update requests: submission, proof documents and lifecycle."""

import shutil
import tempfile
from io import BytesIO
from unittest.mock import patch

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.accounts.models import User
from common.storage.r2 import private_media_storage

from .. import services
from ..models import (
    CompanyDocument,
    CompanyTaxLookupEvidence,
    CompanyUpdateRequest,
    EmployerDpaAcceptance,
    EmployerVerificationCase,
    Industry,
    RecruiterProfile,
)
from .factories import (
    DOCX_BYTES,
    PDF_BYTES,
    PNG_BYTES,
    authenticate_employer,
    company_payload,
    make_recruiter,
)


class CompanyUpdateRequestTests(APITestCase):
    def setUp(self):
        self.user, self.recruiter = make_recruiter()
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

    def test_update_rejects_non_string_company_description(self):
        response = self.client.post(
            reverse('employer-company-update-requests'),
            {'changes': {'description': 123}},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn('description', response.data)

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

    def test_linked_member_can_create_update_request(self):
        member_user, member = make_recruiter('member-update@example.com')
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
        member_user, member = make_recruiter('independent-member@example.com')
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
        member_user, member = make_recruiter('history-member@example.com')
        member.company = self.company
        member.company_role = RecruiterProfile.CompanyRole.MEMBER
        member.save(update_fields=['company', 'company_role', 'updated_at'])
        authenticate_employer(self.client, member_user)

        history = self.client.get(
            reverse('employer-company-update-requests'),
            {'scope': 'company'},
        )
        with patch('apps.employers.api.views.company_documents.private_media_storage') as storage:
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
        member_user, member = make_recruiter('owner-readable-member@example.com')
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
            patch('apps.employers.api.views.company_documents.private_media_storage') as storage,
            patch(
                'apps.employers.api.views.company_documents.render_office_document_preview',
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
        member_user, member = make_recruiter('scoped-document-member@example.com')
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
        member_user, member = make_recruiter('document-write-member@example.com')
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

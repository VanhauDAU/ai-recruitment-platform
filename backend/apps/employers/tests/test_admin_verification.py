from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.core.exceptions import PermissionDenied
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import AdminPermission, AdminRole, Department, User
from apps.accounts.services import assign_membership
from apps.jobs.models import JobCategory

from ..models import (
    Company,
    CompanyDocument,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    EmployerVerificationNotification,
    RecruiterProfile,
    RecruitmentNeed,
)
from ..services import (
    confirm_verification_decision,
    ensure_recruiter_candidate_data_access,
    get_or_create_verification_case,
    reconcile_completed_verification_cases,
    recruiter_is_approved,
    recruiter_posting_readiness,
    verification_decision_impact,
)


class EmployerAccountVerificationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='verification-admin@example.com',
            password='Password@123',
        )
        self.first_user = self._employer('first-recruiter@example.com')
        self.company = Company.objects.create(
            company_name='Công ty dùng chung',
            tax_code='0109999999',
            created_by=self.first_user,
        )
        self.first = self._complete_recruiter(self.first_user)
        self.second_user = self._employer('second-recruiter@example.com')
        self.second = self._complete_recruiter(self.second_user)
        self.category = JobCategory.objects.create(
            name='Kiểm thử xác thực NTD',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        for recruiter in (self.first, self.second):
            RecruitmentNeed.objects.create(
                recruiter=recruiter,
                position_category=self.category,
                position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
                is_continuous=True,
                headcount=1,
                budget_source=RecruitmentNeed.BudgetSource.COMPANY,
                completed_at=timezone.now(),
            )
        self.first_case = self._case_with_approved_documents(self.first)
        self.second_case = self._case_with_approved_documents(self.second)

    def _employer(self, email):
        return User.objects.create_user(
            email=email,
            password='Password@123',
            role=User.Role.EMPLOYER,
            email_verified=True,
        )

    def _complete_recruiter(self, user):
        return RecruiterProfile.objects.create(
            user=user,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
            verified_phone=f'09{user.pk:08d}',
            phone_verified_at=timezone.now(),
            registration_completed_at=timezone.now(),
            dpa_accepted_at=timezone.now(),
        )

    def _case_with_approved_documents(self, recruiter):
        case = get_or_create_verification_case(recruiter)
        case.verification_method = EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
        case.status = EmployerVerificationCase.Status.PENDING
        case.submitted_at = timezone.now()
        case.lock_version = 1
        case.save()
        for doc_type in (
            CompanyDocument.DocType.BUSINESS_REGISTRATION,
            CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        ):
            CompanyDocument.objects.create(
                company=self.company,
                recruiter=recruiter,
                uploaded_by=recruiter.user,
                verification_case=case,
                doc_type=doc_type,
                file_url=f'employers/{recruiter.public_id}/{doc_type}.pdf',
                file_name=f'{doc_type}.pdf',
                mime_type='application/pdf',
                file_size=1024,
                sha256=f'{recruiter.pk:064x}',
                status=CompanyDocument.Status.APPROVED,
            )
        return case

    def test_recruiters_in_same_company_have_independent_cases(self):
        impact = verification_decision_impact(
            self.first_case,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
        )
        confirm_verification_decision(
            self.first_case,
            actor=self.admin,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
            impact_token=impact['impact_token'],
        )

        self.first_case.refresh_from_db()
        self.second_case.refresh_from_db()
        self.assertEqual(self.first_case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertEqual(self.second_case.status, EmployerVerificationCase.Status.PENDING)
        self.assertTrue(recruiter_is_approved(self.first))
        self.assertFalse(recruiter_is_approved(self.second))
        notification = EmployerVerificationNotification.objects.get(
            verification_case=self.first_case,
            event_type='approved',
        )
        self.assertNotIn('file', str(notification.context).lower())
        self.assertNotIn('sha256', str(notification.context).lower())

    @override_settings(
        REQUIRE_APPROVED_EMPLOYER_VERIFICATION=True,
        REQUIRE_APPROVED_EMPLOYER_CANDIDATE_ACCESS=True,
    )
    def test_hard_gate_uses_the_recruiters_own_case(self):
        impact = verification_decision_impact(
            self.first_case,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
        )
        confirm_verification_decision(
            self.first_case,
            actor=self.admin,
            decision=EmployerVerificationCase.Status.APPROVED,
            reason='',
            impact_token=impact['impact_token'],
        )

        _, first_ready = recruiter_posting_readiness(self.first_user)
        _, second_ready = recruiter_posting_readiness(self.second_user)
        self.assertTrue(first_ready)
        self.assertFalse(second_ready)
        ensure_recruiter_candidate_data_access(self.first_user)
        with self.assertRaisesMessage(PermissionDenied, 'xác thực quyền đại diện'):
            ensure_recruiter_candidate_data_access(self.second_user)

    @override_settings(
        REQUIRE_APPROVED_EMPLOYER_VERIFICATION=True,
        REQUIRE_APPROVED_EMPLOYER_CANDIDATE_ACCESS=False,
    )
    def test_candidate_access_gate_can_roll_out_after_posting_gate(self):
        _, ready = recruiter_posting_readiness(self.second_user)
        self.assertFalse(ready)
        ensure_recruiter_candidate_data_access(self.second_user)

    def test_stale_decision_returns_conflict(self):
        self.client.force_authenticate(self.admin)
        impact = self.client.post(
            reverse(
                'admin-employer-verification-decision-impact',
                kwargs={'public_id': self.first_case.public_id},
            ),
            {'decision': 'approved', 'reason': ''},
            format='json',
        )
        self.assertEqual(impact.status_code, 200, impact.data)
        EmployerVerificationCase.objects.filter(pk=self.first_case.pk).update(
            lock_version=self.first_case.lock_version + 1,
        )

        response = self.client.post(
            reverse(
                'admin-employer-verification-decision',
                kwargs={'public_id': self.first_case.public_id},
            ),
            {
                'decision': 'approved',
                'reason': '',
                'impact_token': impact.data['impact_token'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 409, response.data)

    def test_reviewer_approval_of_the_final_document_approves_the_case(self):
        self.client.force_authenticate(self.admin)
        document = self.first_case.documents.filter(is_current=True).first()

        response = self.client.post(
            reverse(
                'admin-employer-verification-review-document',
                kwargs={
                    'public_id': self.first_case.public_id,
                    'document_public_id': document.public_id,
                },
            ),
            {
                'decision': CompanyDocument.Status.APPROVED,
                'reason': '',
                'lock_version': self.first_case.lock_version,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        document.refresh_from_db()
        self.first_case.refresh_from_db()
        self.assertEqual(document.status, CompanyDocument.Status.APPROVED)
        self.assertEqual(self.first_case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertEqual(self.first_case.lock_version, 2)
        self.company.refresh_from_db()
        self.assertEqual(self.company.verification_status, Company.VerificationStatus.VERIFIED)
        self.assertTrue(
            EmployerVerificationNotification.objects.filter(
                verification_case=self.first_case,
                event_type=EmployerVerificationCase.Status.APPROVED,
            ).exists()
        )

    def test_reconciliation_approves_a_previously_completed_case(self):
        reconciled = reconcile_completed_verification_cases()

        self.first_case.refresh_from_db()
        self.assertIn(self.first_case, reconciled)
        self.assertEqual(self.first_case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertTrue(
            EmployerVerificationEvent.objects.filter(
                verification_case=self.first_case,
                event_type=EmployerVerificationEvent.EventType.APPROVED,
                payload__source='reconciliation',
            ).exists()
        )

    def test_queue_filters_overdue_cases(self):
        EmployerVerificationCase.objects.filter(pk=self.first_case.pk).update(
            submitted_at=timezone.now() - timedelta(hours=80),
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(
            reverse('admin-employer-verification-list'),
            {'age': 'over_72h'},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            [item['public_id'] for item in response.data['results']],
            [self.first_case.public_id],
        )

    def test_view_only_reviewer_cannot_open_sensitive_document(self):
        reviewer = User.objects.create_user(
            email='view-only-reviewer@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        permission, _ = AdminPermission.objects.get_or_create(
            code='employer_verification.view',
            defaults={
                'module': 'employer_verification',
                'label': 'Xem xác thực NTD',
            },
        )
        department = Department.objects.create(
            code='verification-ops',
            name='Vận hành xác thực',
        )
        role = AdminRole.objects.create(
            department=department,
            code='verification-viewer',
            name='Người xem xác thực',
        )
        role.permissions.add(permission)
        assign_membership(reviewer, role, actor=self.admin)
        self.client.force_authenticate(reviewer)
        document = self.first_case.documents.filter(is_current=True).first()

        queue = self.client.get(reverse('admin-employer-verification-list'))
        content = self.client.get(
            reverse(
                'admin-employer-verification-document-content',
                kwargs={
                    'public_id': self.first_case.public_id,
                    'document_public_id': document.public_id,
                },
            )
        )

        self.assertEqual(queue.status_code, 200, queue.data)
        self.assertEqual(content.status_code, 403, content.data)

    def test_document_content_infers_legacy_image_mime_for_inline_preview(self):
        self.client.force_authenticate(self.admin)
        document = self.first_case.documents.filter(is_current=True).first()
        document.file_name = 'Giấy đăng ký doanh nghiệp'
        document.file_url = 'employers/legacy/business-registration.webp'
        document.mime_type = ''
        document.save(update_fields=['file_name', 'file_url', 'mime_type', 'updated_at'])

        with patch(
            'apps.employers.api.views.admin_verification.private_media_storage'
        ) as storage_factory:
            storage_factory.return_value.open.return_value = BytesIO(b'RIFFxxxxWEBP')
            response = self.client.get(
                reverse(
                    'admin-employer-verification-document-content',
                    kwargs={
                        'public_id': self.first_case.public_id,
                        'document_public_id': document.public_id,
                    },
                )
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'image/webp')
        self.assertIn('inline', response['Content-Disposition'])
        event = EmployerVerificationEvent.objects.filter(
            verification_case=self.first_case,
            event_type=EmployerVerificationEvent.EventType.SENSITIVE_VIEWED,
        ).latest('created_at')
        self.assertEqual(event.payload['action'], 'preview')
        self.assertEqual(event.payload['audit_version'], 2)
        self.assertEqual(event.payload['document_file_name'], 'Giấy đăng ký doanh nghiệp')

    def test_document_content_converts_private_docx_to_pdf_for_preview(self):
        self.client.force_authenticate(self.admin)
        document = self.first_case.documents.filter(is_current=True).first()
        document.file_url = 'employers/legacy/agreement.docx'
        document.file_name = 'agreement.docx'
        document.mime_type = (
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        document.save(update_fields=['file_url', 'file_name', 'mime_type', 'updated_at'])

        with patch(
            'apps.employers.api.views.admin_verification.render_office_document_preview',
            return_value=b'%PDF-preview',
        ) as render_preview:
            response = self.client.get(
                reverse(
                    'admin-employer-verification-document-content',
                    kwargs={
                        'public_id': self.first_case.public_id,
                        'document_public_id': document.public_id,
                    },
                )
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('inline', response['Content-Disposition'])
        self.assertEqual(b''.join(response.streaming_content), b'%PDF-preview')
        render_preview.assert_called_once_with(
            document.file_url,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )

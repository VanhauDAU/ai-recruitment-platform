from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.core.exceptions import PermissionDenied
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.admin_access_cache import bust_admin_permission_cache
from apps.accounts.models import AdminPermission, AdminRole, Department, User
from apps.accounts.services import assign_membership
from apps.jobs.models import JobCategory

from ..admin import CompanyAdmin, CompanyDocumentAdmin, CompanyUpdateRequestAdmin
from ..models import (
    Company,
    CompanyDocument,
    CompanyIndustry,
    CompanyTaxLookupEvidence,
    CompanyUpdateRequest,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    EmployerVerificationNotification,
    Industry,
    RecruiterProfile,
    RecruitmentNeed,
)
from ..services import (
    confirm_verification_decision,
    ensure_recruiter_candidate_data_access,
    get_or_create_verification_case,
    reconcile_completed_verification_cases,
    reconcile_recruiter_verification,
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

    def test_approving_one_document_keeps_another_rejection_visible(self):
        rejected_document = self.first_case.documents.get(
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT
        )
        rejected_document.status = CompanyDocument.Status.REJECTED
        rejected_document.review_note = 'Văn bản DLCN thiếu chữ ký.'
        rejected_document.save(update_fields=['status', 'review_note'])
        self.first_case.status = EmployerVerificationCase.Status.REJECTED
        self.first_case.decision_reason = rejected_document.review_note
        self.first_case.save(update_fields=['status', 'decision_reason'])
        approved_document = self.first_case.documents.get(
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-employer-verification-review-document',
                kwargs={
                    'public_id': self.first_case.public_id,
                    'document_public_id': approved_document.public_id,
                },
            ),
            {
                'decision': CompanyDocument.Status.APPROVED,
                'reason': 'Nội dung cũ không được giữ khi duyệt.',
                'lock_version': self.first_case.lock_version,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        approved_document.refresh_from_db()
        self.first_case.refresh_from_db()
        self.assertEqual(approved_document.review_note, '')
        self.assertEqual(
            self.first_case.status,
            EmployerVerificationCase.Status.REJECTED,
        )
        self.assertEqual(
            self.first_case.decision_reason,
            'Văn bản DLCN thiếu chữ ký.',
        )

    def test_admin_can_approve_one_of_multiple_unverified_companies_with_same_tax_code(self):
        duplicate_company = Company.objects.create(
            company_name='Công ty trùng MST chưa xác thực',
            tax_code=self.company.tax_code,
            created_by=self.second_user,
        )
        self.second.company = duplicate_company
        self.second.save(update_fields=['company', 'updated_at'])
        self.second_case.company = duplicate_company
        self.second_case.save(update_fields=['company', 'updated_at'])
        self.second_case.documents.update(company=duplicate_company)
        self.client.force_authenticate(self.admin)

        detail = self.client.get(
            reverse(
                'admin-employer-verification-detail',
                kwargs={'public_id': self.second_case.public_id},
            )
        )
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data['company']['duplicate_tax_code_company_count'], 1)
        self.assertEqual(
            detail.data['company']['verified_duplicate_tax_code_company_count'],
            0,
        )

        impact = self.client.post(
            reverse(
                'admin-employer-verification-decision-impact',
                kwargs={'public_id': self.second_case.public_id},
            ),
            {'decision': EmployerVerificationCase.Status.APPROVED, 'reason': ''},
            format='json',
        )
        self.assertEqual(impact.status_code, 200, impact.data)
        response = self.client.post(
            reverse(
                'admin-employer-verification-decision',
                kwargs={'public_id': self.second_case.public_id},
            ),
            {
                'decision': EmployerVerificationCase.Status.APPROVED,
                'reason': '',
                'impact_token': impact.data['impact_token'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        duplicate_company.refresh_from_db()
        self.company.refresh_from_db()
        self.assertEqual(
            duplicate_company.verification_status,
            Company.VerificationStatus.VERIFIED,
        )
        self.assertEqual(
            self.company.verification_status,
            Company.VerificationStatus.UNVERIFIED,
        )
        self.assertEqual(duplicate_company.tax_code, self.company.tax_code)

    def test_verified_company_with_same_tax_code_blocks_approval_with_conflict(self):
        self.company.verification_status = Company.VerificationStatus.VERIFIED
        self.company.verified_at = timezone.now()
        self.company.save(update_fields=['verification_status', 'verified_at', 'updated_at'])
        duplicate_company = Company.objects.create(
            company_name='Công ty chờ duyệt trùng MST',
            tax_code=self.company.tax_code,
            created_by=self.second_user,
        )
        self.second.company = duplicate_company
        self.second.save(update_fields=['company', 'updated_at'])
        self.second_case.company = duplicate_company
        self.second_case.save(update_fields=['company', 'updated_at'])
        self.second_case.documents.update(company=duplicate_company)
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-employer-verification-decision-impact',
                kwargs={'public_id': self.second_case.public_id},
            ),
            {'decision': EmployerVerificationCase.Status.APPROVED, 'reason': ''},
            format='json',
        )

        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data['code'], 'company_tax_code_conflict')
        self.assertIn('đã thuộc một công ty được xác thực', response.data['message'])
        duplicate_company.refresh_from_db()
        self.second_case.refresh_from_db()
        self.assertEqual(
            duplicate_company.verification_status,
            Company.VerificationStatus.UNVERIFIED,
        )
        self.assertEqual(
            self.second_case.status,
            EmployerVerificationCase.Status.PENDING,
        )

    def test_final_document_approval_reports_verified_tax_code_conflict(self):
        self.company.verification_status = Company.VerificationStatus.VERIFIED
        self.company.verified_at = timezone.now()
        self.company.save(update_fields=['verification_status', 'verified_at', 'updated_at'])
        duplicate_company = Company.objects.create(
            company_name='Công ty duyệt giấy tờ trùng MST',
            tax_code=self.company.tax_code,
            created_by=self.second_user,
        )
        self.second.company = duplicate_company
        self.second.save(update_fields=['company', 'updated_at'])
        self.second_case.company = duplicate_company
        self.second_case.save(update_fields=['company', 'updated_at'])
        self.second_case.documents.update(company=duplicate_company)
        document = self.second_case.documents.first()
        document.status = CompanyDocument.Status.PENDING
        document.save(update_fields=['status', 'updated_at'])
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-employer-verification-review-document',
                kwargs={
                    'public_id': self.second_case.public_id,
                    'document_public_id': document.public_id,
                },
            ),
            {
                'decision': CompanyDocument.Status.APPROVED,
                'reason': '',
                'lock_version': self.second_case.lock_version,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data['code'], 'company_tax_code_conflict')
        document.refresh_from_db()
        duplicate_company.refresh_from_db()
        self.second_case.refresh_from_db()
        self.assertEqual(document.status, CompanyDocument.Status.PENDING)
        self.assertEqual(
            duplicate_company.verification_status,
            Company.VerificationStatus.UNVERIFIED,
        )
        self.assertEqual(
            self.second_case.status,
            EmployerVerificationCase.Status.PENDING,
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

    @patch('apps.employers.tasks.tax_lookup.lookup_company_tax_evidence.delay')
    def test_admin_can_refresh_verification_tax_lookup(self, delay):
        self.client.force_authenticate(self.admin)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse(
                    'admin-employer-verification-refresh-tax-lookup',
                    kwargs={'public_id': self.first_case.public_id},
                ),
                format='json',
            )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['tax_lookup_evidence']['status'], 'pending')
        evidence = CompanyTaxLookupEvidence.objects.get(verification_case=self.first_case)
        self.assertEqual(evidence.workflow_revision, self.first_case.revision)
        delay.assert_called_once_with(evidence.pk)

    def test_phone_completed_after_document_review_reconciles_case_once(self):
        self.first.phone_verified_at = None
        self.first.verified_phone = ''
        self.first.save(update_fields=['phone_verified_at', 'verified_phone', 'updated_at'])
        self.first_case.status = EmployerVerificationCase.Status.IN_REVIEW
        self.first_case.save(update_fields=['status', 'updated_at'])

        _, reconciled = reconcile_recruiter_verification(
            self.first,
            source='phone_verified',
        )
        self.assertFalse(reconciled)

        self.first.phone_verified_at = timezone.now()
        self.first.verified_phone = '0901234567'
        self.first.save(update_fields=['phone_verified_at', 'verified_phone', 'updated_at'])
        case, reconciled = reconcile_recruiter_verification(
            self.first,
            source='phone_verified',
        )
        _, reconciled_again = reconcile_recruiter_verification(
            self.first,
            source='phone_verified',
        )

        self.assertTrue(reconciled)
        self.assertFalse(reconciled_again)
        self.assertEqual(case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertEqual(
            EmployerVerificationEvent.objects.filter(
                verification_case=self.first_case,
                event_type=EmployerVerificationEvent.EventType.APPROVED,
                payload__source='phone_verified',
            ).count(),
            1,
        )

    def test_accepting_dpa_last_approves_a_fully_reviewed_case(self):
        self.first.dpa_accepted_at = None
        self.first.save(update_fields=['dpa_accepted_at', 'updated_at'])
        self.first_case.status = EmployerVerificationCase.Status.IN_REVIEW
        self.first_case.save(update_fields=['status', 'updated_at'])
        self.client.force_authenticate(self.first_user)

        response = self.client.post(reverse('employer-dpa-accept'))

        self.assertEqual(response.status_code, 200, response.data)
        self.first_case.refresh_from_db()
        self.assertEqual(self.first_case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertTrue(
            EmployerVerificationEvent.objects.filter(
                verification_case=self.first_case,
                event_type=EmployerVerificationEvent.EventType.APPROVED,
                payload__source='dpa_accepted',
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

    def test_pending_queue_includes_a_rejected_case_with_a_resubmitted_document(self):
        business_document = self.first_case.documents.get(
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION
        )
        business_document.is_current = False
        business_document.status = CompanyDocument.Status.REJECTED
        business_document.save(update_fields=['is_current', 'status', 'updated_at'])
        replacement = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            verification_case=self.first_case,
            supersedes=business_document,
            version=business_document.version + 1,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/replacement-business.pdf',
            file_name='replacement-business.pdf',
            mime_type='application/pdf',
            file_size=1024,
            sha256='f' * 64,
            status=CompanyDocument.Status.PENDING,
        )
        dpa = self.first_case.documents.get(
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT
        )
        dpa.status = CompanyDocument.Status.REJECTED
        dpa.review_note = 'Văn bản dữ liệu cá nhân chưa đạt.'
        dpa.save(update_fields=['status', 'review_note', 'updated_at'])
        self.first_case.status = EmployerVerificationCase.Status.REJECTED
        self.first_case.decision_reason = dpa.review_note
        self.first_case.save(update_fields=['status', 'decision_reason', 'updated_at'])
        self.client.force_authenticate(self.admin)

        response = self.client.get(
            reverse('admin-employer-verification-list'),
            {'status': EmployerVerificationCase.Status.PENDING},
        )

        self.assertEqual(response.status_code, 200, response.data)
        result = next(
            item
            for item in response.data['results']
            if item['public_id'] == self.first_case.public_id
        )
        self.assertEqual(result['status'], EmployerVerificationCase.Status.REJECTED)
        self.assertEqual(result['pending_document_count'], 1)
        self.assertTrue(replacement.is_current)

    def test_actionable_queue_matches_summary_for_an_in_review_case(self):
        self.first_case.status = EmployerVerificationCase.Status.IN_REVIEW
        self.first_case.save(update_fields=['status', 'updated_at'])
        self.second_case.status = EmployerVerificationCase.Status.APPROVED
        self.second_case.save(update_fields=['status', 'updated_at'])
        self.client.force_authenticate(self.admin)

        queue = self.client.get(
            reverse('admin-employer-verification-list'),
            {'status': 'actionable'},
        )
        summary = self.client.get(reverse('admin-employer-verification-summary'))

        self.assertEqual(queue.status_code, 200, queue.data)
        self.assertEqual(summary.status_code, 200, summary.data)
        self.assertEqual(queue.data['count'], summary.data['pending'])
        self.assertEqual(
            [item['public_id'] for item in queue.data['results']],
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

    def test_company_update_permissions_are_independent_from_verification_review(self):
        reviewer = User.objects.create_user(
            email='company-update-reviewer@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        view_permission, _ = AdminPermission.objects.get_or_create(
            code='company_update.view',
            defaults={
                'module': 'company_update',
                'label': 'Xem yêu cầu sửa công ty',
            },
        )
        review_permission, _ = AdminPermission.objects.get_or_create(
            code='company_update.review',
            defaults={
                'module': 'company_update',
                'label': 'Duyệt sửa thông tin công ty',
            },
        )
        department = Department.objects.create(
            code='company-update-ops',
            name='Vận hành cập nhật công ty',
        )
        role = AdminRole.objects.create(
            department=department,
            code='company-update-reviewer',
            name='Chuyên viên duyệt sửa công ty',
        )
        role.permissions.add(view_permission)
        assign_membership(reviewer, role, actor=self.admin)
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'website_url': 'https://example.com/new'},
        )
        self.client.force_authenticate(reviewer)

        company_queue = self.client.get(reverse('admin-company-update-request-list'))
        account_detail = self.client.get(
            reverse('admin-account-detail', kwargs={'public_id': self.first_user.public_id})
        )
        verification_queue = self.client.get(reverse('admin-employer-verification-list'))
        denied_review = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.REJECTED,
                'note': 'Chưa đủ thông tin.',
                'lock_version': 0,
            },
            format='json',
        )

        self.assertEqual(company_queue.status_code, 200, company_queue.data)
        self.assertEqual(account_detail.status_code, 200, account_detail.data)
        self.assertEqual(verification_queue.status_code, 403, verification_queue.data)
        self.assertEqual(denied_review.status_code, 403, denied_review.data)

        role.permissions.add(review_permission)
        bust_admin_permission_cache({reviewer.pk})
        accepted_review = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.REJECTED,
                'note': 'Chưa đủ thông tin.',
                'lock_version': 0,
            },
            format='json',
        )

        self.assertEqual(accepted_review.status_code, 200, accepted_review.data)
        update_request.refresh_from_db()
        self.assertEqual(update_request.status, CompanyUpdateRequest.Status.REJECTED)

    def test_company_update_viewer_cannot_open_sensitive_document(self):
        reviewer = User.objects.create_user(
            email='company-document-viewer@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        view_permission, _ = AdminPermission.objects.get_or_create(
            code='company_update.view',
            defaults={'module': 'company_update', 'label': 'Xem yêu cầu sửa công ty'},
        )
        department = Department.objects.create(
            code='company-document-view',
            name='Xem yêu cầu sửa công ty',
        )
        role = AdminRole.objects.create(
            department=department,
            code='company-document-viewer',
            name='Người xem yêu cầu sửa công ty',
        )
        role.permissions.add(view_permission)
        assign_membership(reviewer, role, actor=self.admin)
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'address': 'Địa chỉ mới'},
            submitted_at=timezone.now(),
        )
        document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/private/company-update.pdf',
            file_name='dang-ky-kinh-doanh.pdf',
            mime_type='application/pdf',
            file_size=2048,
            sha256='a' * 64,
        )
        website_document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.TRADE_NAME_PROOF,
            file_url='https://evidence.example/private-reference',
            file_name='Website chứng minh tên thương mại',
        )
        self.client.force_authenticate(reviewer)

        queue = self.client.get(reverse('admin-company-update-request-list'))
        detail = self.client.get(
            reverse(
                'admin-company-update-request-detail',
                kwargs={'public_id': update_request.public_id},
            )
        )
        content = self.client.get(
            reverse(
                'admin-company-update-request-document-content',
                kwargs={
                    'public_id': update_request.public_id,
                    'document_public_id': document.public_id,
                },
            )
        )

        self.assertEqual(queue.status_code, 200, queue.data)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(content.status_code, 403, content.data)
        redacted_documents = {item['public_id']: item for item in detail.data['documents']}
        redacted = redacted_documents[document.public_id]
        self.assertEqual(redacted['file_name'], '')
        self.assertEqual(redacted['mime_type'], '')
        self.assertEqual(redacted['file_size'], 0)
        self.assertEqual(redacted['sha256'], '')
        self.assertEqual(redacted['uploaded_by_email'], '')
        self.assertIsNone(redacted_documents[website_document.public_id]['source_url'])

        sensitive_permission, _ = AdminPermission.objects.get_or_create(
            code='account.sensitive.view',
            defaults={'module': 'account', 'label': 'Xem dữ liệu nhạy cảm'},
        )
        role.permissions.add(sensitive_permission)
        bust_admin_permission_cache({reviewer.pk})
        revealed_detail = self.client.get(
            reverse(
                'admin-company-update-request-detail',
                kwargs={'public_id': update_request.public_id},
            )
        )

        self.assertEqual(revealed_detail.status_code, 200, revealed_detail.data)
        revealed_documents = {item['public_id']: item for item in revealed_detail.data['documents']}
        revealed = revealed_documents[document.public_id]
        self.assertEqual(revealed['file_name'], 'dang-ky-kinh-doanh.pdf')
        self.assertEqual(revealed['mime_type'], 'application/pdf')
        self.assertEqual(revealed['file_size'], 2048)
        self.assertEqual(revealed['sha256'], 'a' * 64)
        self.assertEqual(revealed['uploaded_by_email'], self.first_user.email)
        self.assertEqual(
            revealed_documents[website_document.public_id]['source_url'],
            'https://evidence.example/private-reference',
        )

    def test_company_update_document_action_is_scoped_to_exact_request(self):
        other_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.second_user,
            changes={'address': 'Địa chỉ của thành viên khác'},
        )
        other_document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.second,
            uploaded_by=self.second_user,
            update_request=other_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/private/other-company-update.pdf',
        )
        first_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'address': 'Địa chỉ của thành viên đầu tiên'},
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review-document',
                kwargs={
                    'public_id': first_request.public_id,
                    'document_public_id': other_document.public_id,
                },
            ),
            {
                'decision': CompanyDocument.Status.APPROVED,
                'reason': '',
                'lock_version': first_request.lock_version,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 404, response.data)
        other_document.refresh_from_db()
        self.assertEqual(other_document.status, CompanyDocument.Status.PENDING)

    def test_django_admin_workflow_models_are_read_only(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'address': 'Địa chỉ mới'},
            submitted_at=timezone.now(),
        )
        model_admins = [
            CompanyAdmin(Company, AdminSite()),
            CompanyDocumentAdmin(CompanyDocument, AdminSite()),
            CompanyUpdateRequestAdmin(CompanyUpdateRequest, AdminSite()),
        ]

        for model_admin in model_admins:
            self.assertIsNone(model_admin.actions)
            self.assertFalse(model_admin.has_add_permission(None))
            self.assertFalse(model_admin.has_change_permission(None))
            self.assertFalse(model_admin.has_delete_permission(None))
            self.assertEqual(
                set(model_admin.get_readonly_fields(None)),
                {field.name for field in model_admin.model._meta.fields},
            )
        self.assertIn(
            'requested_by',
            model_admins[-1].get_readonly_fields(None, update_request),
        )

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

    def test_admin_reviews_company_update_proof_before_applying_change(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'company_name': 'Công ty dùng chung mới'},
            is_sensitive=True,
            reason='Đổi tên theo đăng ký doanh nghiệp',
            proof_type=CompanyUpdateRequest.ProofType.BUSINESS_REGISTRATION,
        )
        document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/update-requests/business-registration.pdf',
            file_name='business-registration.pdf',
            mime_type='application/pdf',
        )
        self.client.force_authenticate(self.admin)

        document_response = self.client.post(
            reverse(
                'admin-company-update-request-review-document',
                kwargs={
                    'public_id': update_request.public_id,
                    'document_public_id': document.public_id,
                },
            ),
            {
                'decision': CompanyDocument.Status.APPROVED,
                'reason': '',
                'lock_version': 0,
            },
            format='json',
        )
        self.assertEqual(document_response.status_code, 200, document_response.data)
        self.assertEqual(document_response.data['lock_version'], 1)

        review_response = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.APPROVED,
                'note': '',
                'lock_version': 1,
            },
            format='json',
        )

        self.assertEqual(review_response.status_code, 200, review_response.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.company_name, 'Công ty dùng chung mới')

    def test_verified_company_tax_code_blocks_company_update_with_conflict_response(self):
        self.company.verification_status = Company.VerificationStatus.VERIFIED
        self.company.verified_at = timezone.now()
        self.company.save(update_fields=['verification_status', 'verified_at', 'updated_at'])
        existing_company = Company.objects.create(
            company_name='Công ty đã xác thực',
            tax_code='0402189757',
            verification_status=Company.VerificationStatus.VERIFIED,
            created_by=self.second_user,
        )
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'tax_code': existing_company.tax_code},
            is_sensitive=True,
            reason='Đổi mã số thuế theo đăng ký doanh nghiệp',
            proof_type=CompanyUpdateRequest.ProofType.BUSINESS_REGISTRATION,
        )
        CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/update-requests/verified-tax-conflict.pdf',
            file_name='verified-tax-conflict.pdf',
            mime_type='application/pdf',
            status=CompanyDocument.Status.APPROVED,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.APPROVED,
                'note': '',
                'lock_version': 0,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data['code'], 'company_tax_code_conflict')
        self.assertIn('đã thuộc một công ty được xác thực', response.data['message'])
        self.company.refresh_from_db()
        update_request.refresh_from_db()
        self.assertEqual(self.company.tax_code, '0109999999')
        self.assertEqual(update_request.status, CompanyUpdateRequest.Status.PENDING)

    def test_unverified_companies_keep_duplicate_tax_codes_when_update_is_approved(self):
        existing_company = Company.objects.create(
            company_name='Công ty chưa xác thực',
            tax_code='0402189757',
            verification_status=Company.VerificationStatus.UNVERIFIED,
            created_by=self.second_user,
        )
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'tax_code': existing_company.tax_code},
            is_sensitive=True,
            reason='Đổi mã số thuế theo đăng ký doanh nghiệp',
            proof_type=CompanyUpdateRequest.ProofType.BUSINESS_REGISTRATION,
        )
        CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/update-requests/unverified-tax-claim.pdf',
            file_name='unverified-tax-claim.pdf',
            mime_type='application/pdf',
            status=CompanyDocument.Status.APPROVED,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.APPROVED,
                'note': '',
                'lock_version': 0,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.company.refresh_from_db()
        existing_company.refresh_from_db()
        update_request.refresh_from_db()
        self.assertEqual(self.company.tax_code, '0402189757')
        self.assertEqual(existing_company.tax_code, '0402189757')
        self.assertEqual(update_request.status, CompanyUpdateRequest.Status.APPROVED)

    def test_admin_can_refresh_company_update_tax_lookup(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'company_name': 'Công ty dùng chung mới'},
            is_sensitive=True,
            reason='Đổi tên theo đăng ký doanh nghiệp',
            proof_type=CompanyUpdateRequest.ProofType.BUSINESS_REGISTRATION,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-refresh-tax-lookup',
                kwargs={'public_id': update_request.public_id},
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['lock_version'], 1)
        self.assertEqual(response.data['tax_lookup_evidence']['status'], 'pending')
        evidence = CompanyTaxLookupEvidence.objects.get(update_request=update_request)
        self.assertEqual(evidence.workflow_revision, update_request.revision)
        self.assertEqual(evidence.submitted_company_name, 'Công ty dùng chung mới')

    def test_employer_sees_company_update_document_revision_request(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'company_name': 'Công ty dùng chung mới'},
            is_sensitive=True,
            reason='Đổi tên theo đăng ký doanh nghiệp',
            proof_type=CompanyUpdateRequest.ProofType.BUSINESS_REGISTRATION,
        )
        document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/update-requests/business-registration.pdf',
            file_name='business-registration.pdf',
            mime_type='application/pdf',
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review-document',
                kwargs={
                    'public_id': update_request.public_id,
                    'document_public_id': document.public_id,
                },
            ),
            {
                'decision': CompanyDocument.Status.CHANGES_REQUESTED,
                'reason': 'Ảnh chụp bị mờ, vui lòng tải bản rõ đủ bốn góc.',
                'lock_version': 0,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.client.force_authenticate(self.first_user)
        employer_response = self.client.get(reverse('employer-company-update-requests'))
        current_document = employer_response.data[0]['documents'][0]
        self.assertEqual(current_document['status'], CompanyDocument.Status.CHANGES_REQUESTED)
        self.assertEqual(current_document['status_label'], 'Cần bổ sung')
        self.assertEqual(current_document['doc_type_label'], 'Giấy đăng ký doanh nghiệp')
        self.assertEqual(
            current_document['review_note'],
            'Ảnh chụp bị mờ, vui lòng tải bản rõ đủ bốn góc.',
        )

    def test_admin_company_update_includes_current_values_for_comparison(self):
        current_industry = Industry.objects.create(name='Lĩnh vực hiện tại đối chiếu')
        proposed_industry = Industry.objects.create(name='Lĩnh vực đề xuất đối chiếu')
        CompanyIndustry.objects.create(
            company=self.company,
            industry=current_industry,
            is_primary=True,
        )
        CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={
                'company_name': 'Công ty dùng chung mới',
                'industries': [proposed_industry.id],
                'primary_industry': proposed_industry.id,
                'gallery_additions': ['employers/company/gallery/proposed.jpg'],
            },
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse('admin-company-update-request-list'))

        self.assertEqual(response.status_code, 200, response.data)
        request_data = response.data['results'][0]
        self.assertEqual(request_data['current_values']['company_name'], 'Công ty dùng chung')
        self.assertEqual(request_data['current_values']['industries'], [current_industry.id])
        self.assertEqual(
            request_data['current_values']['primary_industry'],
            current_industry.id,
        )
        self.assertEqual(
            request_data['industry_labels'][str(proposed_industry.id)],
            'Lĩnh vực đề xuất đối chiếu',
        )
        self.assertEqual(
            request_data['media_previews']['gallery_additions'],
            ['http://testserver/media/employers/company/gallery/proposed.jpg'],
        )

    def test_stale_company_update_review_returns_conflict(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'website_url': 'https://example.com/new'},
            lock_version=2,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.APPROVED,
                'note': '',
                'lock_version': 1,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 409, response.data)
        update_request.refresh_from_db()
        self.assertEqual(update_request.status, CompanyUpdateRequest.Status.PENDING)

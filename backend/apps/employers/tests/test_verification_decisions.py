"""Final verification decisions, resubmission limits and tax overrides."""

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import AdminAccessAuditLog, User
from apps.jobs.models import Job
from apps.jobs.tests.factories import open_visibility_window

from ..models import (
    Company,
    CompanyDocument,
    CompanyTaxLookupEvidence,
    EmployerVerificationCase,
    EmployerVerificationEvent,
)
from ..services import (
    confirm_verification_decision,
    get_or_create_verification_case,
    record_verification_upload,
    review_verification_document,
    start_verification_review,
    unlock_verification_resubmission,
    verification_decision_impact,
)
from .cases import VerificationStateMachineTestCase


class EmployerVerificationDecisionTests(VerificationStateMachineTestCase):
    def test_document_decision_never_decides_recruiter_case(self):
        document = self.case.documents.get(doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION)
        document.status = CompanyDocument.Status.PENDING
        document.save(update_fields=['status', 'updated_at'])

        _, case = review_verification_document(
            document,
            actor=self.reviewer,
            decision=CompanyDocument.Status.APPROVED,
            reason='',
            lock_version=self.case.lock_version,
        )

        self.assertEqual(case.status, EmployerVerificationCase.Status.IN_REVIEW)
        self.assertFalse(
            case.events.filter(event_type=EmployerVerificationEvent.EventType.APPROVED).exists()
        )

    def test_review_services_reject_non_admin_actors_without_relying_on_api(self):
        document = self.case.documents.get(doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION)
        original_lock_version = self.case.lock_version

        with self.assertRaises(PermissionDenied):
            start_verification_review(self.case, actor=self.employer)
        with self.assertRaises(PermissionDenied):
            review_verification_document(
                document,
                actor=self.employer,
                decision=CompanyDocument.Status.APPROVED,
                reason='',
                lock_version=original_lock_version,
            )

        self.case.refresh_from_db()
        document.refresh_from_db()
        self.assertEqual(self.case.lock_version, original_lock_version)
        self.assertNotEqual(document.reviewed_by, self.employer)

    def test_company_relink_is_blocked_and_public_job_fails_closed(self):
        self._approve()
        self.assertEqual(self.client.get(reverse('job-list')).data['count'], 1)
        replacement_company = Company.objects.create(
            company_name='ER-5 replacement company',
            tax_code='0312345689',
            created_by=self.employer,
        )
        self.recruiter.company = replacement_company
        self.recruiter.save(update_fields=['company', 'updated_at'])

        with self.assertRaises(ValidationError) as blocked:
            get_or_create_verification_case(self.recruiter)

        self.assertEqual(
            str(blocked.exception.detail['code']),
            'VERIFICATION_COMPANY_RELINK_REQUIRES_REVIEW',
        )
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertEqual(self.case.company, self.company)
        self.assertEqual(self.client.get(reverse('job-list')).data['count'], 0)

    def test_legacy_active_job_without_verification_case_is_not_public(self):
        # Nobody may open its applications, so the job no longer takes any.
        legacy_employer = User.objects.create_user(
            email='er5-legacy-no-case@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            email_verified=True,
        )
        legacy_company = Company.objects.create(
            company_name='ER-5 legacy grandfather company',
            created_by=legacy_employer,
        )
        legacy_recruiter = self.recruiter.__class__.objects.create(
            user=legacy_employer,
            company=legacy_company,
            registration_completed_at=timezone.now(),
        )
        legacy_job = Job.objects.create(
            posted_by=legacy_employer,
            company=legacy_company,
            title='ER-5 grandfathered active job',
            description='Legacy job without a verification case.',
            status=Job.Status.ACTIVE,
            published_at=timezone.now(),
            **open_visibility_window(),
        )

        response = self.client.get(reverse('job-list'))

        self.assertFalse(
            any(item['public_id'] == legacy_job.public_id for item in response.data['results'])
        )
        self.assertFalse(
            EmployerVerificationCase.objects.filter(recruiter=legacy_recruiter).exists()
        )

    def test_final_decision_requires_in_review_with_stable_error(self):
        self.case.status = EmployerVerificationCase.Status.PENDING
        self.case.save(update_fields=['status', 'updated_at'])
        self.client.force_authenticate(self.reviewer)

        response = self.client.post(
            reverse(
                'admin-employer-verification-decision-impact',
                kwargs={'public_id': self.case.public_id},
            ),
            {'decision': EmployerVerificationCase.Status.APPROVED},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(str(response.data['code']), 'VERIFICATION_INVALID_TRANSITION')

    def test_changes_requested_resubmits_same_case_and_increments_revision(self):
        public_id = self.case.public_id
        self._decide_nonapproval(EmployerVerificationCase.Status.CHANGES_REQUESTED)

        self._replace_business_document_and_resubmit()

        self.assertEqual(self.case.public_id, public_id)
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.PENDING)
        self.assertEqual(self.case.revision, 2)
        self.assertTrue(
            self.case.events.filter(
                event_type=EmployerVerificationEvent.EventType.RESUBMITTED,
                payload__revision=2,
            ).exists()
        )

    def test_rejected_resubmits_same_case_and_increments_revision(self):
        public_id = self.case.public_id
        self._decide_nonapproval(EmployerVerificationCase.Status.REJECTED)

        self._replace_business_document_and_resubmit()

        self.assertEqual(self.case.public_id, public_id)
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.PENDING)
        self.assertEqual(self.case.revision, 2)

        self._replace_business_document_and_resubmit()

        self.assertEqual(self.case.revision, 2)

    def test_rejected_resubmission_can_be_reviewed_and_approved_again(self):
        self._decide_nonapproval(EmployerVerificationCase.Status.REJECTED)
        replacement = self._replace_business_document_and_resubmit()
        self._replace_tax_evidence(CompanyTaxLookupEvidence.Status.FOUND)

        self.case = start_verification_review(self.case, actor=self.reviewer)
        _, self.case = review_verification_document(
            replacement,
            actor=self.reviewer,
            decision=CompanyDocument.Status.APPROVED,
            reason='',
            lock_version=self.case.lock_version,
        )
        self._approve(actor=self.reviewer)

        self.assertEqual(self.case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertEqual(self.case.revision, 2)
        self.assertTrue(
            self.case.events.filter(
                event_type=EmployerVerificationEvent.EventType.REVIEW_STARTED,
            ).exists()
        )

    def test_only_final_rejection_counts_and_third_rejection_locks_resubmission(self):
        self._decide_nonapproval(EmployerVerificationCase.Status.CHANGES_REQUESTED)
        self.case.refresh_from_db()
        self.assertEqual(self.case.final_rejection_count, 0)

        for expected_count in (1, 2, 3):
            if self.case.status != EmployerVerificationCase.Status.IN_REVIEW:
                replacement = self._replace_business_document_and_resubmit()
                self._replace_tax_evidence(CompanyTaxLookupEvidence.Status.FOUND)
                self.case = start_verification_review(self.case, actor=self.reviewer)
                _, self.case = review_verification_document(
                    replacement,
                    actor=self.reviewer,
                    decision=CompanyDocument.Status.APPROVED,
                    reason='',
                    lock_version=self.case.lock_version,
                )
            self._decide_nonapproval(EmployerVerificationCase.Status.REJECTED)
            self.case.refresh_from_db()
            self.assertEqual(self.case.final_rejection_count, expected_count)
            self.assertEqual(
                self.case.resubmission_locked_at is not None,
                expected_count == 3,
            )

        current = self.case.documents.filter(is_current=True).first()
        with self.assertRaisesMessage(ValidationError, 'hết lượt nộp lại'):
            record_verification_upload(
                recruiter=self.recruiter,
                document=current,
                verification_method=self.case.verification_method,
            )

    def test_document_rejection_never_increments_final_rejection_count(self):
        document = self.case.documents.get(
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            is_current=True,
        )
        document.status = CompanyDocument.Status.PENDING
        document.save(update_fields=['status', 'updated_at'])

        _, self.case = review_verification_document(
            document,
            actor=self.reviewer,
            decision=CompanyDocument.Status.REJECTED,
            reason='Bản scan không đọc được.',
            lock_version=self.case.lock_version,
        )

        self.case.refresh_from_db()
        self.assertEqual(self.case.final_rejection_count, 0)
        self.assertIsNone(self.case.resubmission_locked_at)

    def test_high_risk_unlock_preserves_rejection_history_and_is_audited(self):
        self.case.status = EmployerVerificationCase.Status.REJECTED
        self.case.final_rejection_count = 3
        self.case.resubmission_locked_at = timezone.now()
        self.case.save(
            update_fields=[
                'status',
                'final_rejection_count',
                'resubmission_locked_at',
                'updated_at',
            ]
        )

        self.case = unlock_verification_resubmission(
            self.case,
            actor=self.reviewer,
            reason='Đã chấp thuận khiếu nại và đối chiếu bản gốc.',
            lock_version=self.case.lock_version,
        )

        self.assertEqual(self.case.final_rejection_count, 3)
        self.assertIsNone(self.case.resubmission_locked_at)
        self.assertTrue(
            self.case.events.filter(
                event_type=EmployerVerificationEvent.EventType.RESUBMISSION_UNLOCKED,
                payload__final_rejection_count=3,
            ).exists()
        )
        self.assertTrue(
            AdminAccessAuditLog.objects.filter(
                actor=self.reviewer,
                action='unlock_employer_verification_resubmission',
                target_public_id=self.case.public_id,
            ).exists()
        )

    def test_resubmission_unlock_endpoint_enforces_lock_version(self):
        self.case.status = EmployerVerificationCase.Status.REJECTED
        self.case.final_rejection_count = 3
        self.case.resubmission_locked_at = timezone.now()
        self.case.save(
            update_fields=[
                'status',
                'final_rejection_count',
                'resubmission_locked_at',
                'updated_at',
            ]
        )
        url = reverse(
            'admin-employer-verification-unlock-resubmission',
            kwargs={'public_id': self.case.public_id},
        )

        self.client.force_authenticate(self.reviewer)
        stale = self.client.post(
            url,
            {'reason': 'Đã đối chiếu khiếu nại.', 'lock_version': 999},
            format='json',
        )
        self.assertEqual(stale.status_code, status.HTTP_409_CONFLICT)

        unlocked = self.client.post(
            url,
            {
                'reason': 'Đã đối chiếu khiếu nại.',
                'lock_version': self.case.lock_version,
            },
            format='json',
        )
        self.assertEqual(unlocked.status_code, status.HTTP_200_OK, unlocked.data)
        self.assertFalse(unlocked.data['resubmission_locked'])
        self.assertEqual(unlocked.data['final_rejection_count'], 3)
        self.assertEqual(unlocked.data['rejection_limit'], 3)

    def test_multiple_terminal_document_replacements_bump_one_revision_only(self):
        current_documents = list(self.case.documents.filter(is_current=True))
        for document in current_documents:
            document.status = CompanyDocument.Status.REJECTED
            document.review_note = 'Cần thay cả hai tài liệu.'
            document.save(update_fields=['status', 'review_note', 'updated_at'])
        self.case.status = EmployerVerificationCase.Status.REJECTED
        self.case.decision_reason = 'Cần thay cả hai tài liệu.'
        self.case.save(update_fields=['status', 'decision_reason', 'updated_at'])

        for index, current in enumerate(current_documents, start=1):
            current.is_current = False
            current.save(update_fields=['is_current', 'updated_at'])
            replacement = CompanyDocument.objects.create(
                company=self.company,
                recruiter=self.recruiter,
                uploaded_by=self.employer,
                verification_case=self.case,
                supersedes=current,
                version=current.version + 1,
                doc_type=current.doc_type,
                file_url=f'employers/er5/multi-resubmit-{index}.pdf',
                sha256=str(index) * 64,
                status=CompanyDocument.Status.PENDING,
            )
            self.case = record_verification_upload(
                recruiter=self.recruiter,
                document=replacement,
                verification_method=(
                    EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
                ),
            )
            if index < len(current_documents):
                self.assertEqual(self.case.status, EmployerVerificationCase.Status.REJECTED)
                self.assertEqual(self.case.revision, 1)
                self.assertTrue(
                    self.case.events.filter(
                        event_type=EmployerVerificationEvent.EventType.DOCUMENT_REPLACED,
                        payload__document_public_id=replacement.public_id,
                    ).exists()
                )
            else:
                self.assertEqual(self.case.status, EmployerVerificationCase.Status.PENDING)
                self.assertEqual(self.case.revision, 2)

        self.assertEqual(
            self.case.events.filter(
                event_type=EmployerVerificationEvent.EventType.RESUBMITTED
            ).count(),
            1,
        )

    def test_tax_pending_cannot_be_overridden(self):
        self._replace_tax_evidence(CompanyTaxLookupEvidence.Status.PENDING)
        self.client.force_authenticate(self.reviewer)

        response = self.client.post(
            reverse(
                'admin-employer-verification-decision-impact',
                kwargs={'public_id': self.case.public_id},
            ),
            {
                'decision': EmployerVerificationCase.Status.APPROVED,
                'tax_override': True,
                'tax_override_reason': 'Đã đối chiếu thủ công.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(str(response.data['code']), 'TAX_LOOKUP_PENDING')

    def test_rejection_impact_stays_valid_with_multiple_tax_evidence_rows(self):
        CompanyTaxLookupEvidence.objects.create(
            company=self.company,
            verification_case=self.case,
            requested_by=self.employer,
            workflow_revision=self.case.revision,
            tax_code=self.company.tax_code,
            submitted_company_name=self.company.company_name,
            status=CompanyTaxLookupEvidence.Status.UNAVAILABLE,
            response_hash='b' * 64,
            completed_at=timezone.now(),
        )
        payload = {
            'decision': EmployerVerificationCase.Status.REJECTED,
            'reason': 'Giấy tờ không đủ căn cứ xác minh.',
        }
        preview = verification_decision_impact(
            self.case,
            actor=self.reviewer,
            **payload,
        )

        decided = confirm_verification_decision(
            self.case,
            actor=self.reviewer,
            impact_token=preview['impact_token'],
            **payload,
        )

        self.assertEqual(decided.status, EmployerVerificationCase.Status.REJECTED)
        self.assertEqual(decided.final_rejection_count, 1)

    def test_tax_override_by_regular_admin_is_audited(self):
        self._replace_tax_evidence(CompanyTaxLookupEvidence.Status.FOUND, mismatch=True)
        url = reverse(
            'admin-employer-verification-decision-impact',
            kwargs={'public_id': self.case.public_id},
        )
        payload = {
            'decision': EmployerVerificationCase.Status.APPROVED,
            'tax_override': True,
            'tax_override_reason': 'Đã đối chiếu giấy phép bản gốc.',
        }
        self.client.force_authenticate(self.reviewer)
        impact = self.client.post(url, payload, format='json')
        self.assertEqual(impact.status_code, status.HTTP_200_OK, impact.data)
        confirmed = self.client.post(
            reverse(
                'admin-employer-verification-decision',
                kwargs={'public_id': self.case.public_id},
            ),
            {**payload, 'impact_token': impact.data['impact_token']},
            format='json',
        )

        self.assertEqual(confirmed.status_code, status.HTTP_200_OK, confirmed.data)
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertEqual(self.case.tax_override_by, self.reviewer)
        self.assertEqual(
            self.case.tax_override_reason,
            'Đã đối chiếu giấy phép bản gốc.',
        )
        decision_event = self.case.events.filter(
            event_type=EmployerVerificationEvent.EventType.APPROVED
        ).latest('id')
        self.assertTrue(decision_event.payload['tax_override'])
        self.assertEqual(
            decision_event.payload['tax_override_reason'],
            'Đã đối chiếu giấy phép bản gốc.',
        )
        audit = AdminAccessAuditLog.objects.filter(
            action='decide_employer_verification',
            target_public_id=self.case.public_id,
        ).latest('id')
        self.assertEqual(audit.actor, self.reviewer)
        self.assertEqual(
            audit.payload['tax_override_reason'],
            'Đã đối chiếu giấy phép bản gốc.',
        )

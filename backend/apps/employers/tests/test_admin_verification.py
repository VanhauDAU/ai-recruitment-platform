"""Admin review of employer verification cases and their documents."""

from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.conf import settings
from django.contrib.admin.sites import AdminSite
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from apps.accounts.tests.factories import make_admin

from ..admin import (
    CompanyAdmin,
    CompanyDocumentAdmin,
    CompanyUpdateRequestAdmin,
    RecruiterProfileAdmin,
)
from ..models import (
    Company,
    CompanyDocument,
    CompanyUpdateRequest,
    EmployerNotification,
    EmployerNotificationPreference,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    EmployerVerificationNotification,
    RecruiterProfile,
)
from ..services import (
    CandidateDataBlocked,
    confirm_verification_decision,
    ensure_recruiter_candidate_data_access,
    recruiter_is_approved,
    recruiter_posting_readiness,
    verification_decision_impact,
)
from .cases import AdminVerificationTestCase


class EmployerAccountVerificationTests(AdminVerificationTestCase):
    def test_recruiters_in_same_company_have_independent_cases(self):
        self._put_in_review(self.first_case)
        impact = verification_decision_impact(
            self.first_case,
            actor=self.admin,
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

    @override_settings(REQUIRE_APPROVED_EMPLOYER_VERIFICATION=True)
    def test_hard_gate_uses_the_recruiters_own_case(self):
        self._put_in_review(self.first_case)
        impact = verification_decision_impact(
            self.first_case,
            actor=self.admin,
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
        with self.assertRaises(CandidateDataBlocked) as blocked:
            ensure_recruiter_candidate_data_access(self.second_user)
        self.assertEqual(str(blocked.exception.detail['code']), 'CANDIDATE_DATA_BLOCKED')

    def test_stale_decision_returns_conflict(self):
        self._put_in_review(self.first_case)
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

    def test_reviewer_approval_of_the_final_document_keeps_case_in_review(self):
        self._put_in_review(self.first_case)
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
        self.assertEqual(self.first_case.status, EmployerVerificationCase.Status.IN_REVIEW)
        self.assertEqual(self.first_case.lock_version, 2)
        self.assertFalse(
            EmployerVerificationNotification.objects.filter(
                verification_case=self.first_case,
                event_type=EmployerVerificationCase.Status.APPROVED,
            ).exists()
        )

    def test_intermediate_email_preference_never_disables_website_notification(self):
        EmployerNotificationPreference.objects.create(
            recipient=self.first_user,
            intermediate_verification_email=False,
        )
        self._put_in_review(self.first_case)
        document = self.first_case.documents.filter(is_current=True).first()
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-employer-verification-review-document',
                kwargs={
                    'public_id': self.first_case.public_id,
                    'document_public_id': document.public_id,
                },
            ),
            {
                'decision': CompanyDocument.Status.CHANGES_REQUESTED,
                'reason': 'Vui lòng tải bản rõ hơn.',
                'lock_version': self.first_case.lock_version,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(
            EmployerNotification.objects.filter(
                recipient=self.first_user,
                event_type=EmployerNotification.EventType.DOCUMENT_CHANGES_REQUESTED,
            ).exists()
        )
        self.assertFalse(
            EmployerVerificationNotification.objects.filter(
                recipient=self.first_user,
                event_type='document_changes_requested',
            ).exists()
        )

    def test_approving_one_document_keeps_another_rejection_visible(self):
        rejected_document = self.first_case.documents.get(
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT
        )
        rejected_document.status = CompanyDocument.Status.REJECTED
        rejected_document.review_note = 'Văn bản DLCN thiếu chữ ký.'
        rejected_document.save(update_fields=['status', 'review_note'])
        self.first_case.status = EmployerVerificationCase.Status.IN_REVIEW
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
            EmployerVerificationCase.Status.IN_REVIEW,
        )
        self.assertEqual(
            self.first_case.decision_reason,
            'Văn bản DLCN thiếu chữ ký.',
        )

    def test_admin_can_approve_recruiter_when_another_company_has_same_tax_code(self):
        duplicate_company = Company.objects.create(
            company_name='Công ty trùng mã số thuế',
            tax_code=self.company.tax_code,
            created_by=self.second_user,
        )
        self.second.company = duplicate_company
        self.second.save(update_fields=['company', 'updated_at'])
        self.second_case.company = duplicate_company
        self.second_case.save(update_fields=['company', 'updated_at'])
        self.second_case.documents.update(company=duplicate_company)
        self.second_case.tax_lookup_evidences.update(
            company=duplicate_company,
            submitted_company_name=duplicate_company.company_name,
            registered_name=duplicate_company.company_name,
        )
        self._put_in_review(self.second_case)
        original_company_updated_at = self.company.updated_at
        duplicate_company_updated_at = duplicate_company.updated_at
        self.client.force_authenticate(self.admin)

        detail = self.client.get(
            reverse(
                'admin-employer-verification-detail',
                kwargs={'public_id': self.second_case.public_id},
            )
        )
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data['company']['duplicate_tax_code_company_count'], 1)
        self.assertNotIn('verification_status', detail.data['company'])
        self.assertNotIn('verification_source', detail.data['company'])
        self.assertNotIn(
            'verified_duplicate_tax_code_company_count',
            detail.data['company'],
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
        self.assertNotIn('company_impact', impact.data)
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
        self.first_case.refresh_from_db()
        self.second_case.refresh_from_db()
        duplicate_company.refresh_from_db()
        self.company.refresh_from_db()
        self.assertEqual(self.second_case.status, EmployerVerificationCase.Status.APPROVED)
        self.assertEqual(self.first_case.status, EmployerVerificationCase.Status.PENDING)
        self.assertEqual(duplicate_company.tax_code, self.company.tax_code)
        self.assertEqual(duplicate_company.updated_at, duplicate_company_updated_at)
        self.assertEqual(self.company.updated_at, original_company_updated_at)

    def test_rejecting_recruiter_case_does_not_change_shared_company_or_other_case(self):
        self._put_in_review(self.first_case)
        company_updated_at = self.company.updated_at
        self.client.force_authenticate(self.admin)

        impact = self.client.post(
            reverse(
                'admin-employer-verification-decision-impact',
                kwargs={'public_id': self.first_case.public_id},
            ),
            {
                'decision': EmployerVerificationCase.Status.REJECTED,
                'reason': 'Không xác minh được thông tin người tuyển dụng.',
            },
            format='json',
        )
        self.assertEqual(impact.status_code, 200, impact.data)
        self.assertNotIn('company_impact', impact.data)
        response = self.client.post(
            reverse(
                'admin-employer-verification-decision',
                kwargs={'public_id': self.first_case.public_id},
            ),
            {
                'decision': EmployerVerificationCase.Status.REJECTED,
                'reason': 'Không xác minh được thông tin người tuyển dụng.',
                'impact_token': impact.data['impact_token'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.company.refresh_from_db()
        self.first_case.refresh_from_db()
        self.second_case.refresh_from_db()
        self.assertEqual(self.first_case.status, EmployerVerificationCase.Status.REJECTED)
        self.assertEqual(
            self.second_case.status,
            EmployerVerificationCase.Status.PENDING,
        )
        self.assertEqual(self.company.company_name, 'Công ty dùng chung')
        self.assertEqual(self.company.tax_code, '0109999999')
        self.assertEqual(self.company.updated_at, company_updated_at)

    def test_final_document_approval_stays_in_review_with_duplicate_company_tax_code(self):
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
        self._put_in_review(self.second_case)
        duplicate_company_updated_at = duplicate_company.updated_at
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

        self.assertEqual(response.status_code, 200, response.data)
        document.refresh_from_db()
        duplicate_company.refresh_from_db()
        self.second_case.refresh_from_db()
        self.assertEqual(document.status, CompanyDocument.Status.APPROVED)
        self.assertEqual(
            self.second_case.status,
            EmployerVerificationCase.Status.IN_REVIEW,
        )
        self.assertEqual(duplicate_company.tax_code, self.company.tax_code)
        self.assertEqual(duplicate_company.updated_at, duplicate_company_updated_at)

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
        evidence = self.first_case.tax_lookup_evidences.order_by('-created_at', '-id').first()
        self.assertEqual(evidence.workflow_revision, self.first_case.revision)
        delay.assert_called_once_with(evidence.pk)

    def test_accepting_dpa_last_does_not_approve_a_fully_reviewed_case(self):
        self.first.dpa_acceptances.all().delete()
        self.first.dpa_accepted_at = None
        self.first.save(update_fields=['dpa_accepted_at', 'updated_at'])
        self.first_case.status = EmployerVerificationCase.Status.IN_REVIEW
        self.first_case.save(update_fields=['status', 'updated_at'])
        self.client.force_authenticate(self.first_user)

        response = self.client.post(
            reverse('employer-dpa-accept'),
            {
                'policy_version': settings.EMPLOYER_DPA_POLICY_VERSION,
                'document_sha256': settings.EMPLOYER_DPA_DOCUMENT_SHA256,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.first_case.refresh_from_db()
        self.assertEqual(self.first_case.status, EmployerVerificationCase.Status.IN_REVIEW)
        self.assertFalse(
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

    def test_regular_admin_detail_reveals_evidence_but_only_public_snapshot_keys(self):
        self.client.force_authenticate(make_admin())
        document = self.first_case.documents.filter(is_current=True).first()
        evidence = self.first_case.tax_lookup_evidences.order_by('-created_at', '-id').first()
        evidence.response_hash = 'f' * 64
        evidence.save(update_fields=['response_hash', 'updated_at'])
        self.first_case.decision_snapshot = {
            'case_public_id': self.first_case.public_id,
            'case_revision': self.first_case.revision,
            'lock_version': self.first_case.lock_version,
            'decision': EmployerVerificationCase.Status.APPROVED,
            'reason': '',
            'checks': {},
            'tax_advisory': {},
            'tax_override': False,
            'tax_override_reason': '',
            'capability_impact': {},
            'verification_hold_impact': {},
            'integrity_fingerprint': 'internal-fingerprint',
            'future_unknown_field': 'must-not-leak',
        }
        self.first_case.save(update_fields=['decision_snapshot', 'updated_at'])
        event = EmployerVerificationEvent.objects.create(
            verification_case=self.first_case,
            actor=self.admin,
            event_type=EmployerVerificationEvent.EventType.SENSITIVE_VIEWED,
            payload={
                'document_public_id': document.public_id,
                'document_file_name': 'hop-dong-noi-bo.pdf',
                'action': 'preview',
            },
        )

        queue = self.client.get(reverse('admin-employer-verification-list'))
        detail = self.client.get(
            reverse(
                'admin-employer-verification-detail',
                kwargs={'public_id': self.first_case.public_id},
            )
        )

        self.assertEqual(queue.status_code, 200, queue.data)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data['tax_lookup_evidence']['response_hash'], 'f' * 64)
        self.assertNotIn('company_impact', detail.data['decision_snapshot'])
        self.assertNotIn('integrity_fingerprint', detail.data['decision_snapshot'])
        self.assertNotIn('future_unknown_field', detail.data['decision_snapshot'])
        event_payload = next(
            item['payload']
            for item in detail.data['events']
            if item['public_id'] == event.public_id
        )
        self.assertEqual(event_payload['document_file_name'], 'hop-dong-noi-bo.pdf')

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
        recruiter_admin = RecruiterProfileAdmin(RecruiterProfile, AdminSite())
        self.assertIn('company', recruiter_admin.get_readonly_fields(None, self.first))
        self.assertIn('company_role', recruiter_admin.get_readonly_fields(None, self.first))
        self.assertIn('contact_phone', recruiter_admin.get_readonly_fields(None, self.first))

        forged_company = Company.objects.create(
            company_name='Công ty giả mạo qua Django admin',
            tax_code='0108888888',
            created_by=self.admin,
        )
        original_company_id = self.first.company_id
        original_company_role = self.first.company_role
        self.first.company = forged_company
        self.first.company_role = RecruiterProfile.CompanyRole.OWNER
        recruiter_admin.save_model(None, self.first, form=None, change=True)

        self.first.refresh_from_db()
        self.assertEqual(self.first.company_id, original_company_id)
        self.assertEqual(self.first.company_role, original_company_role)

    def test_document_content_infers_legacy_image_mime_for_inline_preview(self):
        self.client.force_authenticate(self.admin)
        document = self.first_case.documents.filter(is_current=True).first()
        document.file_name = 'Giấy đăng ký doanh nghiệp'
        document.file_url = 'employers/legacy/business-registration.webp'
        document.mime_type = ''
        document.save(update_fields=['file_name', 'file_url', 'mime_type', 'updated_at'])

        with patch(
            'apps.employers.api.views.admin_verification.documents.private_media_storage'
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
            'apps.employers.api.views.admin_verification.documents.render_office_document_preview',
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

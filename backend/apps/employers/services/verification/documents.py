"""Recruiter proof uploads and the administrator's per-document review."""

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.api.permissions import require_admin
from apps.accounts.services import (
    StaleImpactToken,
    record_admin_action,
)

from ...models import (
    CompanyDocument,
    EmployerVerificationCase,
    EmployerVerificationEvent,
)
from ..compliance import lock_verification_identity
from ..tax_lookup import queue_company_tax_lookup
from .cases import (
    MAX_FINAL_REJECTIONS,
    current_document_issue,
    get_or_create_verification_case,
    queue_verification_notification,
    workflow_error,
)


@transaction.atomic
def record_verification_upload(
    *,
    recruiter,
    document,
    verification_method='',
):
    case = get_or_create_verification_case(recruiter)
    if case.resubmission_locked_at is not None:
        workflow_error(
            'VERIFICATION_RESUBMISSION_LOCKED',
            'Hồ sơ đã hết lượt nộp lại. Vui lòng gửi khiếu nại để được quản trị viên xem xét.',
            final_rejection_count=case.final_rejection_count,
            rejection_limit=MAX_FINAL_REJECTIONS,
        )
    locked_documents = tuple(
        CompanyDocument.objects.select_for_update(of=('self',))
        .filter(Q(verification_case_id=case.pk) | Q(pk=document.pk))
        .order_by('pk')
    )
    document = next((item for item in locked_documents if item.pk == document.pk), None)
    if document is None:
        workflow_error(
            'VERIFICATION_DOCUMENT_CHANGED',
            'Giấy tờ không còn thuộc hồ sơ xác thực.',
        )
    if (
        document.verification_case_id not in {None, case.pk}
        or (document.recruiter_id is not None and document.recruiter_id != case.recruiter_id)
        or (document.company_id is not None and document.company_id != case.company_id)
    ):
        workflow_error(
            'VERIFICATION_DOCUMENT_SCOPE_INVALID',
            'Giấy tờ không thuộc nhà tuyển dụng hoặc công ty của hồ sơ.',
        )
    if verification_method:
        case.verification_method = verification_method
    elif (
        not case.verification_method
        and document.doc_type == CompanyDocument.DocType.BUSINESS_REGISTRATION
    ):
        case.verification_method = EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION

    terminal_resubmission = case.status in {
        EmployerVerificationCase.Status.CHANGES_REQUESTED,
        EmployerVerificationCase.Status.REJECTED,
        EmployerVerificationCase.Status.REVOKED,
        EmployerVerificationCase.Status.EXPIRED,
    }
    issue_status, _ = current_document_issue(
        case,
        documents=locked_documents,
    )
    resubmission_ready = terminal_resubmission and issue_status is None
    if not terminal_resubmission or resubmission_ready:
        case.status = EmployerVerificationCase.Status.PENDING
        case.submitted_at = timezone.now()
        case.review_started_at = None
        case.decided_at = None
        case.decision_reason = ''
        case.reviewer = None
        case.decision_source = ''
        case.decision_snapshot = {}
        case.tax_override_reason = ''
        case.tax_override_by = None
    case.lock_version += 1
    if resubmission_ready:
        case.revision += 1
    case.save(
        update_fields=[
            'company',
            'verification_method',
            'status',
            'submitted_at',
            'review_started_at',
            'decided_at',
            'decision_reason',
            'reviewer',
            'lock_version',
            'revision',
            'decision_source',
            'decision_snapshot',
            'tax_override_reason',
            'tax_override_by',
            'updated_at',
        ]
    )
    if document.verification_case_id != case.pk:
        document.verification_case = case
        document.save(update_fields=['verification_case', 'updated_at'])
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=recruiter.user,
        event_type=(
            EmployerVerificationEvent.EventType.RESUBMITTED
            if resubmission_ready
            else (
                EmployerVerificationEvent.EventType.DOCUMENT_REPLACED
                if terminal_resubmission
                else EmployerVerificationEvent.EventType.SUBMITTED
            )
        ),
        payload={
            'document_public_id': document.public_id,
            'doc_type': document.doc_type,
            'revision': case.revision,
            'resubmission_ready': resubmission_ready,
            'remaining_document_issue': issue_status or '',
        },
    )
    if (
        case.company_id
        and case.company.tax_code
        and not case.tax_lookup_evidences.filter(workflow_revision=case.revision).exists()
    ):
        try:
            queue_company_tax_lookup(
                company=case.company,
                requested_by=recruiter.user,
                verification_case=case,
                workflow_revision=case.revision,
            )
        except ValueError:
            # Legacy companies may contain a pre-validation tax code. Their
            # documents still enter manual review without an external lookup.
            pass
    return case


@transaction.atomic
def start_verification_review(case, *, actor):
    require_admin(actor)
    case = lock_verification_identity(case).case
    if case.status not in {
        EmployerVerificationCase.Status.PENDING,
        EmployerVerificationCase.Status.IN_REVIEW,
    }:
        workflow_error(
            'VERIFICATION_INVALID_TRANSITION',
            'Chỉ hồ sơ đang chờ mới có thể bắt đầu xử lý.',
            current_status=case.status,
            allowed_statuses=[EmployerVerificationCase.Status.PENDING],
        )
    if case.status != EmployerVerificationCase.Status.IN_REVIEW:
        case.status = EmployerVerificationCase.Status.IN_REVIEW
        case.reviewer = actor
        case.review_started_at = timezone.now()
        case.lock_version += 1
        case.save(
            update_fields=[
                'status',
                'reviewer',
                'review_started_at',
                'lock_version',
                'updated_at',
            ]
        )
        EmployerVerificationEvent.objects.create(
            verification_case=case,
            actor=actor,
            event_type=EmployerVerificationEvent.EventType.REVIEW_STARTED,
        )
    return case


@transaction.atomic
def review_verification_document(document, *, actor, decision, reason, lock_version):
    require_admin(actor)
    if document.verification_case_id is None:
        workflow_error(
            'VERIFICATION_DOCUMENT_NOT_ATTACHED',
            'Giấy tờ không thuộc hồ sơ xác thực.',
        )
    scope = lock_verification_identity(EmployerVerificationCase(pk=document.verification_case_id))
    case = scope.case
    document = CompanyDocument.objects.select_for_update(of=('self',)).get(pk=document.pk)
    if document.verification_case_id != case.pk or not document.is_current:
        workflow_error(
            'VERIFICATION_DOCUMENT_CHANGED',
            'Giấy tờ đã thay đổi. Vui lòng tải lại.',
        )
    if case.lock_version != lock_version:
        raise StaleImpactToken('Hồ sơ đã thay đổi. Vui lòng tải lại.')
    if case.status != EmployerVerificationCase.Status.IN_REVIEW:
        workflow_error(
            'VERIFICATION_INVALID_TRANSITION',
            'Chỉ được xử lý giấy tờ khi hồ sơ đang được review.',
            current_status=case.status,
            allowed_statuses=[EmployerVerificationCase.Status.IN_REVIEW],
        )
    if decision not in {
        CompanyDocument.Status.APPROVED,
        CompanyDocument.Status.CHANGES_REQUESTED,
        CompanyDocument.Status.REJECTED,
    }:
        raise ValidationError('Kết quả xử lý giấy tờ không hợp lệ.')
    if decision != CompanyDocument.Status.APPROVED and not reason.strip():
        raise ValidationError('Cần nhập lý do khi yêu cầu bổ sung hoặc từ chối.')
    normalized_reason = '' if decision == CompanyDocument.Status.APPROVED else reason.strip()
    document.status = decision
    document.reviewed_by = actor
    document.reviewed_at = timezone.now()
    document.review_note = normalized_reason
    document.save(
        update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at']
    )
    case.reviewer = actor
    case.review_started_at = case.review_started_at or timezone.now()
    case.lock_version += 1
    case.save(
        update_fields=[
            'reviewer',
            'review_started_at',
            'lock_version',
            'updated_at',
        ]
    )
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=actor,
        event_type=EmployerVerificationEvent.EventType.DOCUMENT_REVIEWED,
        payload={
            'document_public_id': document.public_id,
            'doc_type': document.doc_type,
            'decision': decision,
            'reason': normalized_reason,
            'case_status': EmployerVerificationCase.Status.IN_REVIEW,
        },
    )
    record_admin_action(
        actor=actor,
        action='review_employer_verification_document',
        target_type='employer_verification_document',
        target_public_id=document.public_id,
        payload={
            'decision': decision,
            'reason': normalized_reason,
            'case_public_id': case.public_id,
            'tax_lookup_evidence_public_id': (
                case.tax_lookup_evidences.filter(workflow_revision=case.revision)
                .order_by('-created_at', '-id')
                .values_list('public_id', flat=True)
                .first()
            ),
        },
    )
    if decision in {
        CompanyDocument.Status.CHANGES_REQUESTED,
        CompanyDocument.Status.REJECTED,
    }:
        queue_verification_notification(
            case,
            event_type=f'document_{decision}',
            reason=reason,
        )
    return document, case


def record_verification_document_access(document, *, actor, intent):
    """Audit an administrator opening private proof (``intent``: preview/download).

    Reading proof is itself a sensitive event, so this GET path writes on purpose.
    """
    EmployerVerificationEvent.objects.create(
        verification_case=document.verification_case,
        actor=actor,
        event_type=EmployerVerificationEvent.EventType.SENSITIVE_VIEWED,
        payload={
            'document_public_id': document.public_id,
            'document_file_name': document.file_name,
            'document_type': document.doc_type,
            'document_type_label': document.get_doc_type_display(),
            'action': intent,
            'audit_version': 2,
        },
    )
    record_admin_action(
        actor=actor,
        action=f'{intent}_employer_verification_document',
        target_type='employer_verification_document',
        target_public_id=document.public_id,
        payload={'case_public_id': document.verification_case.public_id},
    )

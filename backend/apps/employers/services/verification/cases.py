"""Verification case lifecycle basics: creation, prerequisite checks and notices."""

import logging

from django.db import transaction
from django.utils.translation import gettext
from rest_framework.exceptions import ValidationError

from apps.sitecontent.selectors import approved_employer_verification_required, get_int_setting

from ...models import (
    CompanyDocument,
    DpaStatus,
    EmployerNotification,
    EmployerVerificationCase,
    EmployerVerificationNotification,
)
from ...models.readiness import current_dpa_status
from ..compliance import lock_or_create_verification_identity
from ..notifications import emit_employer_event, intermediate_verification_email_enabled

BUSINESS_DOCUMENT_TYPES = frozenset(
    {
        CompanyDocument.DocType.BUSINESS_REGISTRATION,
        CompanyDocument.DocType.AUTHORIZATION_LETTER,
        CompanyDocument.DocType.IDENTITY_DOCUMENT,
    }
)

logger = logging.getLogger(__name__)


def workflow_error(code, detail, **extra):
    raise ValidationError({'code': code, 'detail': detail, **extra})


def queue_verification_notification(case, *, event_type, reason=''):
    dedupe_key = f'verification:{case.public_id}:{case.lock_version}:{event_type}'
    website_event_type = {
        'approved': EmployerNotification.EventType.VERIFICATION_APPROVED,
        'changes_requested': EmployerNotification.EventType.VERIFICATION_CHANGES_REQUESTED,
        'rejected': EmployerNotification.EventType.VERIFICATION_REJECTED,
        'revoked': EmployerNotification.EventType.VERIFICATION_REVOKED,
        'expired': EmployerNotification.EventType.VERIFICATION_EXPIRED,
        'document_changes_requested': (EmployerNotification.EventType.DOCUMENT_CHANGES_REQUESTED),
        'document_rejected': EmployerNotification.EventType.DOCUMENT_REJECTED,
    }.get(event_type)
    if website_event_type:
        emit_employer_event(
            recipient=case.recruiter.user,
            event_type=website_event_type,
            dedupe_key=dedupe_key,
            message=reason,
            subject_public_id=case.public_id,
            metadata={'case_public_id': case.public_id, 'status': case.status},
        )
    if event_type.startswith('document_') and not intermediate_verification_email_enabled(
        case.recruiter.user
    ):
        return None
    job, _ = EmployerVerificationNotification.objects.get_or_create(
        recipient=case.recruiter.user,
        dedupe_key=dedupe_key,
        defaults={
            'verification_case': case,
            'event_type': event_type,
            'context': {
                'case_public_id': case.public_id,
                'reason': reason.strip(),
            },
        },
    )

    def dispatch():
        from ...tasks import deliver_employer_verification_notification

        try:
            deliver_employer_verification_notification.delay(job.pk)
        except Exception:  # noqa: BLE001 - persisted row is retried by the sweep
            logger.exception(
                'Could not enqueue employer verification email %s; the sweep retries it.',
                job.pk,
            )

    transaction.on_commit(dispatch)
    return job


@transaction.atomic
def get_or_create_verification_case(recruiter):
    scope = lock_or_create_verification_identity(recruiter)
    recruiter = scope.recruiter
    case = scope.case
    if case.company_id != recruiter.company_id:
        if case.company_id is not None or recruiter.company_id is None:
            workflow_error(
                'VERIFICATION_COMPANY_RELINK_REQUIRES_REVIEW',
                gettext('Không thể tự chuyển hồ sơ xác thực sang công ty khác.'),
            )
        case.company = scope.company
        case.status = EmployerVerificationCase.Status.DRAFT
        case.verification_method = ''
        case.revision += 1
        case.lock_version += 1
        case.decision_source = ''
        case.decision_snapshot = {}
        case.tax_override_reason = ''
        case.tax_override_by = None
        case.save(
            update_fields=[
                'company',
                'status',
                'verification_method',
                'revision',
                'lock_version',
                'decision_source',
                'decision_snapshot',
                'tax_override_reason',
                'tax_override_by',
                'updated_at',
            ]
        )
    return case


def required_document_types(case):
    if case.verification_method == EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID:
        business = {
            CompanyDocument.DocType.AUTHORIZATION_LETTER,
            CompanyDocument.DocType.IDENTITY_DOCUMENT,
        }
    else:
        business = {CompanyDocument.DocType.BUSINESS_REGISTRATION}
    return business | {CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT}


def verification_checks(case):
    recruiter = case.recruiter
    documents = getattr(case, 'current_documents_for_checks', None)
    if documents is None:
        prefetched_documents = getattr(case, '_prefetched_objects_cache', {}).get('documents')
        documents = (
            [document for document in prefetched_documents if document.is_current]
            if prefetched_documents is not None
            else case.documents.filter(is_current=True)
        )
    current_documents = {}
    for document in documents:
        current_documents.setdefault(document.doc_type, []).append(document)
    required = required_document_types(case)
    business_required = required & BUSINESS_DOCUMENT_TYPES
    return {
        'email_verified': recruiter.user.email_verified,
        'registration_completed': recruiter.registration_completed_at is not None,
        'phone_verified': recruiter.has_verified_phone,
        'company_linked': recruiter.company_id is not None
        and case.company_id == recruiter.company_id,
        'representative_documents_submitted': business_required.issubset(current_documents),
        'business_documents_approved': all(
            current_documents.get(doc_type)
            and all(
                document.status == CompanyDocument.Status.APPROVED
                for document in current_documents[doc_type]
            )
            for doc_type in business_required
        ),
        'candidate_dpa_submitted': (
            CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT in current_documents
        ),
        'candidate_dpa_approved': (
            bool(current_documents.get(CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT))
            and all(
                document.status == CompanyDocument.Status.APPROVED
                for document in current_documents[CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT]
            )
        ),
        'dpa_accepted': current_dpa_status(recruiter) == DpaStatus.CURRENT,
        'case_approved': case.status == EmployerVerificationCase.Status.APPROVED,
    }


def verification_can_be_approved(case):
    checks = verification_checks(case)
    required = {
        'email_verified',
        'registration_completed',
        'phone_verified',
        'company_linked',
        'representative_documents_submitted',
        'business_documents_approved',
        'candidate_dpa_submitted',
        'candidate_dpa_approved',
        'dpa_accepted',
    }
    return all(checks[key] for key in required), checks


def recruiter_is_approved(recruiter):
    try:
        return recruiter.verification_case.status == EmployerVerificationCase.Status.APPROVED
    except EmployerVerificationCase.DoesNotExist:
        return False


def recruiter_requires_approved_verification():
    """Máy chủ bắt buộc HOẶC admin bật bắt buộc; admin chỉ siết được, không nới (ADR-0026)."""
    return approved_employer_verification_required()


def max_final_rejections():
    """Số lần bị từ chối cuối cùng trước khi khoá nộp lại hồ sơ xác thực."""
    return min(max(get_int_setting('employer_verification_max_rejections', 3), 1), 10)


def current_document_issue(case, *, documents=None):
    current_documents = (
        [document for document in documents if document.is_current]
        if documents is not None
        else list(case.documents.filter(is_current=True))
    )
    rejected = next(
        (
            document
            for document in sorted(
                current_documents,
                key=lambda item: (
                    item.reviewed_at or item.updated_at,
                    item.updated_at,
                    item.pk,
                ),
                reverse=True,
            )
            if document.status == CompanyDocument.Status.REJECTED
        ),
        None,
    )
    if rejected is not None:
        return EmployerVerificationCase.Status.REJECTED, rejected.review_note
    changes_requested = next(
        (
            document
            for document in sorted(
                current_documents,
                key=lambda item: (
                    item.reviewed_at or item.updated_at,
                    item.updated_at,
                    item.pk,
                ),
                reverse=True,
            )
            if document.status == CompanyDocument.Status.CHANGES_REQUESTED
        ),
        None,
    )
    if changes_requested is not None:
        return (
            EmployerVerificationCase.Status.CHANGES_REQUESTED,
            changes_requested.review_note,
        )
    return None, ''

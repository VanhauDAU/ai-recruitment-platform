"""Employer-account verification workflows."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.accounts.services import (
    InvalidImpactToken,
    StaleImpactToken,
    create_impact_token,
    decode_impact_token,
    record_admin_action,
)

from ..models import (
    Company,
    CompanyDocument,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    EmployerVerificationNotification,
)

BUSINESS_DOCUMENT_TYPES = frozenset(
    {
        CompanyDocument.DocType.BUSINESS_REGISTRATION,
        CompanyDocument.DocType.AUTHORIZATION_LETTER,
        CompanyDocument.DocType.IDENTITY_DOCUMENT,
    }
)


def _queue_verification_notification(case, *, event_type, reason=''):
    job = EmployerVerificationNotification.objects.create(
        verification_case=case,
        recipient=case.recruiter.user,
        event_type=event_type,
        context={
            'case_public_id': case.public_id,
            'reason': reason.strip(),
        },
    )

    def dispatch():
        from ..tasks import deliver_employer_verification_notification

        try:
            deliver_employer_verification_notification.delay(job.pk)
        except Exception:  # noqa: BLE001 - persisted row is retried by the sweep
            return

    transaction.on_commit(dispatch)
    return job


def get_or_create_verification_case(recruiter):
    case, _ = EmployerVerificationCase.objects.get_or_create(
        recruiter=recruiter,
        defaults={'company': recruiter.company},
    )
    if recruiter.company_id and case.company_id != recruiter.company_id:
        case.company = recruiter.company
        case.status = EmployerVerificationCase.Status.DRAFT
        case.verification_method = ''
        case.revision += 1
        case.lock_version += 1
        case.save(
            update_fields=[
                'company',
                'status',
                'verification_method',
                'revision',
                'lock_version',
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
        documents = case.documents.filter(is_current=True)
    current_documents = {document.doc_type: document for document in documents}
    recruitment_needs = getattr(recruiter, 'verification_recruitment_needs', None)
    consulting_need_completed = (
        bool(recruitment_needs)
        if recruitment_needs is not None
        else recruiter.recruitment_needs.exists()
    )
    required = required_document_types(case)
    business_required = required & BUSINESS_DOCUMENT_TYPES
    return {
        'email_verified': recruiter.user.email_verified,
        'registration_completed': recruiter.registration_completed_at is not None,
        'consulting_need_completed': consulting_need_completed,
        'phone_verified': recruiter.phone_verified_at is not None,
        'company_linked': recruiter.company_id is not None
        and case.company_id == recruiter.company_id,
        'representative_documents_submitted': business_required.issubset(current_documents),
        'business_documents_approved': all(
            current_documents.get(doc_type)
            and current_documents[doc_type].status == CompanyDocument.Status.APPROVED
            for doc_type in business_required
        ),
        'candidate_dpa_submitted': (
            CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT in current_documents
        ),
        'candidate_dpa_approved': (
            current_documents.get(CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT) is not None
            and current_documents[CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT].status
            == CompanyDocument.Status.APPROVED
        ),
        'dpa_accepted': recruiter.dpa_accepted_at is not None,
        'case_approved': case.status == EmployerVerificationCase.Status.APPROVED,
    }


def verification_can_be_approved(case):
    checks = verification_checks(case)
    required = {
        'email_verified',
        'registration_completed',
        'consulting_need_completed',
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
    return bool(getattr(settings, 'REQUIRE_APPROVED_EMPLOYER_VERIFICATION', False))


@transaction.atomic
def record_verification_upload(
    *,
    recruiter,
    document,
    verification_method='',
):
    case = EmployerVerificationCase.objects.select_for_update().get(
        pk=get_or_create_verification_case(recruiter).pk
    )
    if verification_method:
        case.verification_method = verification_method
    elif (
        not case.verification_method
        and document.doc_type == CompanyDocument.DocType.BUSINESS_REGISTRATION
    ):
        case.verification_method = EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION

    resubmission = case.status in {
        EmployerVerificationCase.Status.CHANGES_REQUESTED,
        EmployerVerificationCase.Status.REJECTED,
    }
    case.company = recruiter.company
    case.status = EmployerVerificationCase.Status.PENDING
    case.submitted_at = timezone.now()
    case.review_started_at = None
    case.decided_at = None
    case.decision_reason = ''
    case.reviewer = None
    case.lock_version += 1
    if resubmission:
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
            'updated_at',
        ]
    )
    if document.verification_case_id != case.id:
        document.verification_case = case
        document.save(update_fields=['verification_case', 'updated_at'])
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=recruiter.user,
        event_type=(
            EmployerVerificationEvent.EventType.RESUBMITTED
            if resubmission
            else EmployerVerificationEvent.EventType.SUBMITTED
        ),
        payload={
            'document_public_id': document.public_id,
            'doc_type': document.doc_type,
            'revision': case.revision,
        },
    )
    return case


@transaction.atomic
def start_verification_review(case, *, actor):
    case = EmployerVerificationCase.objects.select_for_update().get(pk=case.pk)
    if case.status not in {
        EmployerVerificationCase.Status.PENDING,
        EmployerVerificationCase.Status.IN_REVIEW,
    }:
        raise ValidationError('Chỉ hồ sơ đang chờ mới có thể bắt đầu xử lý.')
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
    document = (
        CompanyDocument.objects.select_for_update()
        .select_related('verification_case')
        .get(pk=document.pk)
    )
    case = EmployerVerificationCase.objects.select_for_update().get(
        pk=document.verification_case_id
    )
    if case.lock_version != lock_version:
        raise StaleImpactToken('Hồ sơ đã thay đổi. Vui lòng tải lại.')
    if decision not in {
        CompanyDocument.Status.APPROVED,
        CompanyDocument.Status.CHANGES_REQUESTED,
        CompanyDocument.Status.REJECTED,
    }:
        raise ValidationError('Kết quả xử lý giấy tờ không hợp lệ.')
    if decision != CompanyDocument.Status.APPROVED and not reason.strip():
        raise ValidationError('Cần nhập lý do khi yêu cầu bổ sung hoặc từ chối.')
    document.status = decision
    document.reviewed_by = actor
    document.reviewed_at = timezone.now()
    document.review_note = reason.strip()
    document.save(
        update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at']
    )
    case.reviewer = actor
    case.review_started_at = case.review_started_at or timezone.now()
    case.lock_version += 1
    if decision == CompanyDocument.Status.CHANGES_REQUESTED:
        case.status = EmployerVerificationCase.Status.CHANGES_REQUESTED
        case.decision_reason = reason.strip()
    elif decision == CompanyDocument.Status.REJECTED:
        case.status = EmployerVerificationCase.Status.REJECTED
        case.decision_reason = reason.strip()
        case.decided_at = timezone.now()
    elif case.status == EmployerVerificationCase.Status.PENDING:
        case.status = EmployerVerificationCase.Status.IN_REVIEW
    case.save(
        update_fields=[
            'status',
            'reviewer',
            'review_started_at',
            'decision_reason',
            'decided_at',
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
            'reason': reason.strip(),
        },
    )
    record_admin_action(
        actor=actor,
        action='review_employer_verification_document',
        target_type='employer_verification_document',
        target_public_id=document.public_id,
        payload={'decision': decision, 'case_public_id': case.public_id},
    )
    if decision in {
        CompanyDocument.Status.CHANGES_REQUESTED,
        CompanyDocument.Status.REJECTED,
    }:
        _queue_verification_notification(
            case,
            event_type=f'document_{decision}',
            reason=reason,
        )
    return document, case


def verification_decision_impact(case, *, decision, reason):
    if decision not in {
        EmployerVerificationCase.Status.APPROVED,
        EmployerVerificationCase.Status.CHANGES_REQUESTED,
        EmployerVerificationCase.Status.REJECTED,
    }:
        raise ValidationError('Kết quả xử lý hồ sơ không hợp lệ.')
    if decision != EmployerVerificationCase.Status.APPROVED and not reason.strip():
        raise ValidationError('Cần nhập lý do khi yêu cầu bổ sung hoặc từ chối.')
    can_approve, checks = verification_can_be_approved(case)
    if decision == EmployerVerificationCase.Status.APPROVED and not can_approve:
        missing = [key for key, value in checks.items() if not value and key != 'case_approved']
        raise ValidationError({'missing_requirements': missing})
    payload = {'decision': decision, 'reason': reason.strip()}
    return {
        'decision': decision,
        'reason': reason.strip(),
        'checks': checks,
        'unlocks_employer_capabilities': decision == EmployerVerificationCase.Status.APPROVED,
        'impact_token': create_impact_token(
            revision=case.lock_version,
            operation='employer_verification.decision',
            resource_key=case.public_id,
            normalized_payload=payload,
        ),
    }


@transaction.atomic
def confirm_verification_decision(case, *, actor, decision, reason, impact_token):
    # Lock only the case row. PostgreSQL cannot apply FOR UPDATE to nullable
    # outer joins such as the optional company/reviewer relations.
    case = EmployerVerificationCase.objects.select_for_update().get(pk=case.pk)
    payload = {'decision': decision, 'reason': reason.strip()}
    claims = decode_impact_token(
        impact_token,
        operation='employer_verification.decision',
        resource_key=case.public_id,
        normalized_payload=payload,
    )
    if claims['revision'] != case.lock_version:
        raise StaleImpactToken('Hồ sơ đã thay đổi sau khi xem tác động.')
    verification_decision_impact(case, decision=decision, reason=reason)

    case.status = decision
    case.reviewer = actor
    case.decided_at = timezone.now()
    case.decision_reason = reason.strip()
    case.lock_version += 1
    case.save(
        update_fields=[
            'status',
            'reviewer',
            'decided_at',
            'decision_reason',
            'lock_version',
            'updated_at',
        ]
    )
    if decision == EmployerVerificationCase.Status.APPROVED and case.company_id:
        Company.objects.filter(pk=case.company_id).update(
            verification_status=Company.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
            rejected_reason='',
        )
    event_type = {
        EmployerVerificationCase.Status.APPROVED: EmployerVerificationEvent.EventType.APPROVED,
        EmployerVerificationCase.Status.CHANGES_REQUESTED: (
            EmployerVerificationEvent.EventType.CHANGES_REQUESTED
        ),
        EmployerVerificationCase.Status.REJECTED: EmployerVerificationEvent.EventType.REJECTED,
    }[decision]
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=actor,
        event_type=event_type,
        payload={'reason': reason.strip(), 'revision': case.revision},
    )
    record_admin_action(
        actor=actor,
        action='decide_employer_verification',
        target_type='employer_verification',
        target_public_id=case.public_id,
        payload={'decision': decision, 'user_public_id': case.recruiter.user.public_id},
    )
    _queue_verification_notification(
        case,
        event_type=decision,
        reason=reason,
    )
    return case


__all__ = [
    'InvalidImpactToken',
    'StaleImpactToken',
    'confirm_verification_decision',
    'get_or_create_verification_case',
    'record_verification_upload',
    'recruiter_is_approved',
    'recruiter_requires_approved_verification',
    'required_document_types',
    'review_verification_document',
    'start_verification_review',
    'verification_checks',
    'verification_decision_impact',
]

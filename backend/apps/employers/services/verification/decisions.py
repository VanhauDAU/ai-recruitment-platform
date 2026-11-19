"""Final verification decisions (approve, request changes, reject) and resubmission unlock.

Every decision is previewed first; the preview's impact token must still match
when the administrator confirms.
"""

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from apps.accounts.api.permissions import require_admin
from apps.accounts.services import (
    StaleImpactToken,
    create_impact_token,
    decode_impact_token,
    record_admin_action,
)

from ...models import (
    CompanyTaxLookupEvidence,
    EmployerVerificationCase,
    EmployerVerificationEvent,
)
from ..compliance import (
    lock_verification_identity,
    release_verification_holds,
)
from .cases import (
    MAX_FINAL_REJECTIONS,
    queue_verification_notification,
    verification_can_be_approved,
    workflow_error,
)
from .impact import (
    integrity_fingerprint,
    normalized_legal_text,
    verification_hold_impact,
    verification_snapshot_scope,
)

FINAL_DECISIONS = frozenset(
    {
        EmployerVerificationCase.Status.APPROVED,
        EmployerVerificationCase.Status.CHANGES_REQUESTED,
        EmployerVerificationCase.Status.REJECTED,
    }
)


def _tax_advisory(case, *, evidences=None):
    if evidences is None:
        evidence = (
            CompanyTaxLookupEvidence.objects.filter(
                verification_case=case,
                workflow_revision=case.revision,
            )
            .order_by('-created_at', '-id')
            .first()
        )
    else:
        evidence = next(
            (
                item
                for item in sorted(
                    evidences,
                    key=lambda item: (item.created_at, item.pk),
                    reverse=True,
                )
                if item.workflow_revision == case.revision
            ),
            None,
        )
    if evidence is None:
        return {
            'status': 'missing',
            'provider_status': None,
            'evidence_public_id': None,
            'comparison': {'tax_code': 'unavailable', 'company_name': 'unavailable'},
            'requires_override': True,
        }
    company = case.company if case.company_id else None
    if company is None or (
        evidence.tax_code != (company.tax_code or '')
        or normalized_legal_text(evidence.submitted_company_name)
        != normalized_legal_text(company.company_name)
    ):
        return {
            'status': 'invalid',
            'provider_status': evidence.status,
            'evidence_public_id': evidence.public_id,
            'comparison': {
                'tax_code': 'stale_input',
                'company_name': 'stale_input',
            },
            'requires_override': True,
        }
    if evidence.status == CompanyTaxLookupEvidence.Status.PENDING:
        status = 'pending'
        comparison = {'tax_code': 'pending', 'company_name': 'pending'}
    elif evidence.status == CompanyTaxLookupEvidence.Status.FOUND:
        comparison = {
            'tax_code': 'match' if evidence.tax_code == evidence.returned_tax_code else 'mismatch',
            'company_name': (
                'match'
                if normalized_legal_text(evidence.submitted_company_name)
                == normalized_legal_text(evidence.registered_name)
                else 'mismatch'
            ),
        }
        status = 'matched' if set(comparison.values()) == {'match'} else 'mismatch'
    elif evidence.status == CompanyTaxLookupEvidence.Status.NOT_FOUND:
        status = 'not_found'
        comparison = {'tax_code': 'unavailable', 'company_name': 'unavailable'}
    elif evidence.status == CompanyTaxLookupEvidence.Status.UNAVAILABLE:
        status = 'unavailable'
        comparison = {'tax_code': 'unavailable', 'company_name': 'unavailable'}
    else:
        status = 'invalid'
        comparison = {'tax_code': 'unavailable', 'company_name': 'unavailable'}
    return {
        'status': status,
        'provider_status': evidence.status,
        'evidence_public_id': evidence.public_id,
        'comparison': comparison,
        'requires_override': status in {'mismatch', 'not_found', 'unavailable', 'invalid'},
    }


def _prepare_final_decision(
    case,
    *,
    actor,
    decision,
    reason,
    tax_override=False,
    tax_override_reason='',
    scope=None,
    enforce_current_state=True,
    require_reason=True,
):
    """Validate a final decision; previews pass ``require_reason=False``.

    A preview may run before the admin has typed a reason so the impact shows
    as soon as the dialog opens. The reason is part of the signed payload, so
    the confirm always re-checks it and a blank-reason token cannot be reused.
    """
    require_admin(actor)
    scope = scope or verification_snapshot_scope(case)
    if decision not in FINAL_DECISIONS:
        workflow_error(
            'VERIFICATION_DECISION_INVALID',
            _('Kết quả xử lý hồ sơ không hợp lệ.'),
        )
    if enforce_current_state and case.status != EmployerVerificationCase.Status.IN_REVIEW:
        workflow_error(
            'VERIFICATION_INVALID_TRANSITION',
            _('Quyết định cuối chỉ áp dụng cho hồ sơ đang được review.'),
            current_status=case.status,
            allowed_statuses=[EmployerVerificationCase.Status.IN_REVIEW],
        )
    reason = reason.strip()
    if require_reason and decision != EmployerVerificationCase.Status.APPROVED and not reason:
        workflow_error(
            'VERIFICATION_REASON_REQUIRED',
            _('Cần nhập lý do khi yêu cầu bổ sung hoặc từ chối.'),
        )
    case._state.fields_cache['recruiter'] = scope.recruiter
    if scope.company is not None:
        case._state.fields_cache['company'] = scope.company
    case.current_documents_for_checks = [
        document for document in scope.documents if document.is_current
    ]
    scope.recruiter.verification_recruitment_needs = list(scope.recruitment_needs)
    can_approve, checks = verification_can_be_approved(case)
    if (
        enforce_current_state
        and decision == EmployerVerificationCase.Status.APPROVED
        and not can_approve
    ):
        missing = [key for key, value in checks.items() if not value and key != 'case_approved']
        workflow_error(
            'VERIFICATION_REQUIREMENTS_INCOMPLETE',
            _('Hồ sơ chưa đủ điều kiện để duyệt.'),
            missing_requirements=missing,
        )

    tax = _tax_advisory(case, evidences=scope.tax_evidences)
    effective_override = bool(
        decision == EmployerVerificationCase.Status.APPROVED
        and tax['requires_override']
        and tax_override
    )
    normalized_override_reason = tax_override_reason.strip() if effective_override else ''
    if decision == EmployerVerificationCase.Status.APPROVED:
        if enforce_current_state and tax['status'] == 'pending':
            workflow_error(
                'TAX_LOOKUP_PENDING',
                _('Đang chờ kết quả tra cứu mã số thuế.'),
            )
        if enforce_current_state and tax['requires_override'] and not effective_override:
            workflow_error(
                'TAX_OVERRIDE_REQUIRED',
                _('Kết quả tra cứu thuế cần quyền override và lý do.'),
                tax_status=tax['status'],
            )
        if effective_override:
            require_admin(actor)
            if require_reason and not normalized_override_reason:
                workflow_error(
                    'TAX_OVERRIDE_REASON_REQUIRED',
                    _('Cần nhập lý do override kết quả tra cứu thuế.'),
                )
    hold_impact = verification_hold_impact(case, scope=scope)
    snapshot = {
        'case_public_id': case.public_id,
        'case_revision': case.revision,
        'lock_version': case.lock_version,
        'decision': decision,
        'reason': reason,
        'checks': checks,
        'tax_advisory': tax,
        'tax_override': effective_override,
        'tax_override_reason': normalized_override_reason,
        'capability_impact': {
            'candidate_data_access': (
                'eligible_after_recompute'
                if decision == EmployerVerificationCase.Status.APPROVED
                else 'blocked'
            ),
            'job_approval': (
                'eligible_after_recompute'
                if decision == EmployerVerificationCase.Status.APPROVED
                else 'blocked'
            ),
            'job_workspace': 'unchanged',
        },
        'verification_hold_impact': (
            hold_impact
            if decision == EmployerVerificationCase.Status.APPROVED
            else {
                'hold_count': 0,
                'campaign_count': 0,
                'job_count': 0,
                'active_jobs_to_unhide': 0,
            }
        ),
        'rejection_impact': {
            'current_count': case.final_rejection_count,
            'next_count': (
                case.final_rejection_count + 1
                if decision == EmployerVerificationCase.Status.REJECTED
                else case.final_rejection_count
            ),
            'limit': MAX_FINAL_REJECTIONS,
            'will_lock_resubmission': bool(
                decision == EmployerVerificationCase.Status.REJECTED
                and case.final_rejection_count + 1 >= MAX_FINAL_REJECTIONS
            ),
        },
        'integrity_fingerprint': integrity_fingerprint(case, scope=scope),
    }
    request_payload = {
        'decision': decision,
        'reason': reason,
        'tax_override': effective_override,
        'tax_override_reason': normalized_override_reason,
    }
    return request_payload, snapshot


def verification_decision_impact(
    case,
    *,
    actor,
    decision,
    reason,
    tax_override=False,
    tax_override_reason='',
):
    payload, snapshot = _prepare_final_decision(
        case,
        actor=actor,
        decision=decision,
        reason=reason,
        tax_override=tax_override,
        tax_override_reason=tax_override_reason,
        require_reason=False,
    )
    return {
        **{key: value for key, value in snapshot.items() if key != 'integrity_fingerprint'},
        'unlocks_employer_capabilities': decision == EmployerVerificationCase.Status.APPROVED,
        'impact_token': create_impact_token(
            revision=case.lock_version,
            operation='employer_verification.decision',
            resource_key=case.public_id,
            normalized_payload={'request': payload, 'snapshot': snapshot},
        ),
    }


@transaction.atomic
def confirm_verification_decision(
    case,
    *,
    actor,
    decision,
    reason,
    impact_token,
    tax_override=False,
    tax_override_reason='',
):
    scope = lock_verification_identity(case, include_resources=True)
    case = scope.case
    try:
        payload, snapshot = _prepare_final_decision(
            case,
            actor=actor,
            decision=decision,
            reason=reason,
            tax_override=tax_override,
            tax_override_reason=tax_override_reason,
            scope=scope,
        )
    except ValidationError as current_state_error:
        payload, snapshot = _prepare_final_decision(
            case,
            actor=actor,
            decision=decision,
            reason=reason,
            tax_override=tax_override,
            tax_override_reason=tax_override_reason,
            scope=scope,
            enforce_current_state=False,
        )
        decode_impact_token(
            impact_token,
            operation='employer_verification.decision',
            resource_key=case.public_id,
            normalized_payload={'request': payload, 'snapshot': snapshot},
        )
        raise current_state_error
    claims = decode_impact_token(
        impact_token,
        operation='employer_verification.decision',
        resource_key=case.public_id,
        normalized_payload={'request': payload, 'snapshot': snapshot},
    )
    if claims['revision'] != case.lock_version:
        raise StaleImpactToken(_('Hồ sơ đã thay đổi sau khi xem tác động.'))

    released_holds = []
    if decision == EmployerVerificationCase.Status.APPROVED:
        released_holds = release_verification_holds(
            scope,
            actor=actor,
            reason='verification_reapproved',
        )
    case.status = decision
    case.reviewer = actor
    case.decided_at = timezone.now()
    case.decision_reason = payload['reason']
    case.decision_source = EmployerVerificationCase.DecisionSource.EXPLICIT_ADMIN
    case.decision_snapshot = snapshot
    case.tax_override_reason = payload['tax_override_reason']
    case.tax_override_by = actor if payload['tax_override'] else None
    if decision == EmployerVerificationCase.Status.REJECTED:
        case.final_rejection_count += 1
        if case.final_rejection_count >= MAX_FINAL_REJECTIONS:
            case.resubmission_locked_at = timezone.now()
    elif decision == EmployerVerificationCase.Status.APPROVED:
        case.resubmission_locked_at = None
    case.lock_version += 1
    case.save(
        update_fields=[
            'status',
            'reviewer',
            'decided_at',
            'decision_reason',
            'decision_source',
            'decision_snapshot',
            'tax_override_reason',
            'tax_override_by',
            'final_rejection_count',
            'resubmission_locked_at',
            'lock_version',
            'updated_at',
        ]
    )
    event_type = {
        EmployerVerificationCase.Status.APPROVED: (
            EmployerVerificationEvent.EventType.REAPPROVED
            if released_holds
            else EmployerVerificationEvent.EventType.APPROVED
        ),
        EmployerVerificationCase.Status.CHANGES_REQUESTED: (
            EmployerVerificationEvent.EventType.CHANGES_REQUESTED
        ),
        EmployerVerificationCase.Status.REJECTED: EmployerVerificationEvent.EventType.REJECTED,
    }[decision]
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=actor,
        event_type=event_type,
        payload={
            'reason': payload['reason'],
            'revision': case.revision,
            'decision_source': case.decision_source,
            'tax_advisory_status': snapshot['tax_advisory']['status'],
            'tax_override': payload['tax_override'],
            'tax_override_reason': payload['tax_override_reason'],
            'final_rejection_count': case.final_rejection_count,
            'resubmission_locked': case.resubmission_locked_at is not None,
        },
    )
    for hold in released_holds:
        EmployerVerificationEvent.objects.create(
            verification_case=case,
            actor=actor,
            event_type=EmployerVerificationEvent.EventType.HOLD_RELEASED,
            payload={
                'hold_public_id': hold.public_id,
                'source': hold.source,
                'reason': hold.reason,
            },
        )
    record_admin_action(
        actor=actor,
        action='decide_employer_verification',
        target_type='employer_verification',
        target_public_id=case.public_id,
        payload={
            'decision': decision,
            'user_public_id': scope.user.public_id,
            'tax_lookup_evidence_public_id': snapshot['tax_advisory']['evidence_public_id'],
            'tax_override': payload['tax_override'],
            'tax_override_reason': payload['tax_override_reason'],
            'released_verification_hold_count': len(released_holds),
        },
    )
    queue_verification_notification(
        case,
        event_type=decision,
        reason=reason,
    )
    return case


@transaction.atomic
def unlock_verification_resubmission(case, *, actor, reason, lock_version):
    require_admin(actor)
    case = lock_verification_identity(case).case
    reason = reason.strip()
    if not reason:
        workflow_error(
            'VERIFICATION_REASON_REQUIRED',
            _('Cần nhập lý do mở khóa nộp lại.'),
        )
    if case.lock_version != lock_version:
        raise StaleImpactToken(_('Hồ sơ đã thay đổi. Vui lòng tải lại.'))
    if (
        case.status != EmployerVerificationCase.Status.REJECTED
        or case.resubmission_locked_at is None
    ):
        workflow_error(
            'VERIFICATION_INVALID_TRANSITION',
            _('Chỉ hồ sơ bị từ chối và đang khóa nộp lại mới có thể được mở khóa.'),
            current_status=case.status,
            allowed_statuses=[EmployerVerificationCase.Status.REJECTED],
        )
    case.resubmission_locked_at = None
    case.lock_version += 1
    case.save(update_fields=['resubmission_locked_at', 'lock_version', 'updated_at'])
    EmployerVerificationEvent.objects.create(
        verification_case=case,
        actor=actor,
        event_type=EmployerVerificationEvent.EventType.RESUBMISSION_UNLOCKED,
        payload={
            'reason': reason,
            'final_rejection_count': case.final_rejection_count,
        },
    )
    record_admin_action(
        actor=actor,
        action='unlock_employer_verification_resubmission',
        target_type='employer_verification',
        target_public_id=case.public_id,
        payload={
            'reason': reason,
            'final_rejection_count': case.final_rejection_count,
        },
    )
    return case

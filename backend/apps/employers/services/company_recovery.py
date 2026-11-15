"""Audited recovery for a recruiter linked to the wrong company."""

from __future__ import annotations

import hashlib
import json

from django.db import transaction

from apps.accounts.models import User
from apps.accounts.permissions import require_admin
from apps.accounts.services import (
    StaleImpactToken,
    create_impact_token,
    decode_impact_token,
    record_admin_action,
)
from apps.jobs.models import Job

from ..models import (
    Company,
    CompanyDocument,
    CompanyUpdateRequest,
    EmployerCompanyLinkEvent,
    EmployerComplianceHold,
    EmployerNotification,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    RecruiterProfile,
    RecruitmentCampaign,
    RecruitmentNeed,
)
from ..models.verification import REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES
from .company_page_editors import revoke_page_editor_grants_on_unlink
from .notifications import emit_employer_event

COMPANY_UNLINK_OPERATION = 'employer.company.unlink'


class CompanyUnlinkError(ValueError):
    def __init__(self, code, message, *, blockers=()):
        self.code = code
        self.message = message
        self.blockers = tuple(blockers)
        super().__init__(code)


def _marker(value):
    return value.isoformat() if value else ''


def _locked_identity(user):
    locked_user = User.objects.select_for_update(of=('self',)).get(pk=user.pk)
    recruiter = (
        RecruiterProfile.objects.select_for_update(of=('self',))
        .select_related('company')
        .filter(user=locked_user)
        .first()
    )
    if recruiter is None or recruiter.company_id is None:
        raise CompanyUnlinkError(
            'COMPANY_LINK_NOT_FOUND',
            'Nhà tuyển dụng hiện không liên kết với công ty nào.',
        )
    verification_case = (
        EmployerVerificationCase.objects.select_for_update(of=('self',))
        .filter(recruiter=recruiter)
        .first()
    )
    company = Company.objects.select_for_update(of=('self',)).get(pk=recruiter.company_id)
    recruiter.company = company
    if verification_case is not None:
        recruiter._state.fields_cache['verification_case'] = verification_case
    return locked_user, recruiter, verification_case, company


def _identity(user, *, lock):
    if lock:
        return _locked_identity(user)
    recruiter = RecruiterProfile.objects.select_related('company').filter(user=user).first()
    if recruiter is None or recruiter.company_id is None:
        raise CompanyUnlinkError(
            'COMPANY_LINK_NOT_FOUND',
            'Nhà tuyển dụng hiện không liên kết với công ty nào.',
        )
    verification_case = EmployerVerificationCase.objects.filter(recruiter=recruiter).first()
    return user, recruiter, verification_case, recruiter.company


def _verification_documents(verification_case):
    if verification_case is None:
        return CompanyDocument.objects.none()
    return CompanyDocument.objects.filter(
        verification_case=verification_case, is_current=True
    ).exclude(status=CompanyDocument.Status.APPROVED)


def _open_update_requests(user, company):
    return CompanyUpdateRequest.objects.filter(
        requested_by=user,
        company=company,
        status__in=REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES
        | {CompanyUpdateRequest.Status.IN_REVIEW},
    )


def _clean_snapshot(user, recruiter, verification_case, company):
    """Group what the link carries: kept as is, withdrawn by the unlink, or blocking.

    Recruitment needs belong to the recruiter, and history is audit evidence:
    neither blocks. Anything not yet approved is withdrawn with the link. Only
    what already took effect for this company blocks, with the step to undo it.
    """
    case_status = verification_case.status if verification_case is not None else ''
    counts = {
        'recruitment_needs': RecruitmentNeed.objects.filter(recruiter=recruiter).count(),
        'jobs': Job.objects.filter(posted_by=user).count(),
        'active_jobs': Job.objects.filter(
            posted_by=user, company=company, status=Job.Status.ACTIVE
        ).count(),
        'open_campaigns': RecruitmentCampaign.objects.filter(owner=recruiter)
        .exclude(
            status__in=[
                RecruitmentCampaign.Status.COMPLETED,
                RecruitmentCampaign.Status.CANCELLED,
            ]
        )
        .count(),
        'active_compliance_holds': EmployerComplianceHold.objects.filter(
            recruiter=recruiter,
            status=EmployerComplianceHold.Status.ACTIVE,
        ).count(),
        'other_members': RecruiterProfile.objects.filter(company=company)
        .exclude(pk=recruiter.pk)
        .count(),
        'withdrawn_documents': _verification_documents(verification_case).count(),
        'cancelled_update_requests': _open_update_requests(user, company).count(),
    }
    blockers = []
    if recruiter.company_role == RecruiterProfile.CompanyRole.OWNER and counts['other_members']:
        blockers.append('COMPANY_OWNER_WITH_MEMBERS')
    if case_status == EmployerVerificationCase.Status.APPROVED:
        blockers.append('VERIFICATION_APPROVED')
    if counts['active_jobs']:
        blockers.append('ACTIVE_JOBS_EXIST')
    if counts['open_campaigns']:
        blockers.append('OPEN_CAMPAIGNS_EXIST')
    if counts['active_compliance_holds']:
        blockers.append('COMPLIANCE_HOLDS_EXIST')
    withdrawals = []
    if case_status not in {'', EmployerVerificationCase.Status.DRAFT} and (
        case_status != EmployerVerificationCase.Status.APPROVED
    ):
        withdrawals.append('VERIFICATION_CASE')
    if counts['withdrawn_documents']:
        withdrawals.append('VERIFICATION_DOCUMENTS')
    if counts['cancelled_update_requests']:
        withdrawals.append('COMPANY_UPDATE_REQUESTS')
    snapshot = {
        'user_public_id': user.public_id,
        'user_status': user.status,
        'auth_revision': user.auth_revision,
        'recruiter_public_id': recruiter.public_id,
        'recruiter_updated_at': _marker(recruiter.updated_at),
        'company_public_id': company.public_id,
        'company_name': company.company_name,
        'company_updated_at': _marker(company.updated_at),
        'company_role': recruiter.company_role,
        'verification_case_public_id': (
            verification_case.public_id if verification_case is not None else ''
        ),
        'verification_case_updated_at': (
            _marker(verification_case.updated_at) if verification_case is not None else ''
        ),
        'counts': counts,
        'blockers': blockers,
        'withdrawals': withdrawals,
    }
    encoded = json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    snapshot['integrity_revision'] = int(hashlib.sha256(encoded.encode()).hexdigest()[:15], 16)
    return snapshot


def _withdraw_unapproved_evidence(user, verification_case, company, *, actor, event):
    """What was submitted for this company but never approved goes with the link."""
    _verification_documents(verification_case).update(is_current=False)
    _open_update_requests(user, company).update(status=CompanyUpdateRequest.Status.CANCELLED)
    if verification_case is None:
        return
    previous_status = verification_case.status
    if previous_status != EmployerVerificationCase.Status.DRAFT:
        EmployerVerificationEvent.objects.create(
            verification_case=verification_case,
            actor=actor,
            event_type=EmployerVerificationEvent.EventType.WITHDRAWN_BY_UNLINK,
            payload={
                'company_public_id': company.public_id,
                'previous_status': previous_status,
                'link_event_public_id': event.public_id,
            },
        )
    # Back to a clean draft for the next company; anti-abuse counters stay.
    verification_case.company = None
    verification_case.status = EmployerVerificationCase.Status.DRAFT
    verification_case.verification_method = ''
    verification_case.reviewer = None
    verification_case.submitted_at = None
    verification_case.review_started_at = None
    verification_case.decided_at = None
    verification_case.decision_reason = ''
    verification_case.decision_source = ''
    verification_case.decision_snapshot = {}
    verification_case.lock_version += 1
    verification_case.save()


def company_unlink_impact(user, *, actor, reason):
    require_admin(actor)
    normalized_reason = (reason or '').strip()
    if not normalized_reason:
        raise CompanyUnlinkError('COMPANY_UNLINK_REASON_REQUIRED', 'Nhập lý do gỡ liên kết.')
    user, recruiter, verification_case, company = _identity(user, lock=False)
    snapshot = _clean_snapshot(user, recruiter, verification_case, company)
    can_apply = not snapshot['blockers']
    return {
        'operation': COMPANY_UNLINK_OPERATION,
        'target': {
            'user_public_id': user.public_id,
            'recruiter_public_id': recruiter.public_id,
            'company_public_id': company.public_id,
            'company_name': company.company_name,
            'company_role': recruiter.company_role,
        },
        'counts': snapshot['counts'],
        'blockers': snapshot['blockers'],
        'withdrawals': snapshot['withdrawals'],
        'can_apply': can_apply,
        'impact_token': (
            create_impact_token(
                revision=snapshot['integrity_revision'],
                operation=COMPANY_UNLINK_OPERATION,
                resource_key=user.public_id,
                normalized_payload={'reason': normalized_reason, 'snapshot': snapshot},
            )
            if can_apply
            else ''
        ),
    }


@transaction.atomic
def confirm_company_unlink(user, *, actor, reason, impact_token):
    require_admin(actor)
    normalized_reason = (reason or '').strip()
    if not normalized_reason:
        raise CompanyUnlinkError('COMPANY_UNLINK_REASON_REQUIRED', 'Nhập lý do gỡ liên kết.')
    user, recruiter, verification_case, company = _identity(user, lock=True)
    snapshot = _clean_snapshot(user, recruiter, verification_case, company)
    claims = decode_impact_token(
        impact_token,
        operation=COMPANY_UNLINK_OPERATION,
        resource_key=user.public_id,
        normalized_payload={'reason': normalized_reason, 'snapshot': snapshot},
    )
    if claims['revision'] != snapshot['integrity_revision']:
        raise StaleImpactToken('Liên kết công ty đã thay đổi sau khi xem tác động.')
    if snapshot['blockers']:
        raise CompanyUnlinkError(
            'COMPANY_LINK_NOT_CLEAN',
            'Liên kết đang có dữ liệu đã có hiệu lực với công ty; xử lý các mục chặn trước.',
            blockers=snapshot['blockers'],
        )

    event_snapshot = {
        key: value
        for key, value in snapshot.items()
        if key not in {'integrity_revision', 'recruiter_updated_at', 'company_updated_at'}
    }
    event = EmployerCompanyLinkEvent.objects.create(
        recruiter=recruiter,
        company=company,
        actor=actor,
        event_type=EmployerCompanyLinkEvent.EventType.ADMIN_UNLINKED,
        reason=normalized_reason,
        impact_snapshot=event_snapshot,
    )
    emit_employer_event(
        recipient=user,
        actor=actor,
        event_type=EmployerNotification.EventType.COMPANY_LINK_REMOVED,
        dedupe_key=f'company-link-event:{event.public_id}',
        message='Quản trị viên đã gỡ liên kết công ty theo yêu cầu hỗ trợ.',
        subject_public_id=company.public_id,
        metadata={
            'company_public_id': company.public_id,
            'event_public_id': event.public_id,
        },
    )
    revoke_page_editor_grants_on_unlink(recruiter, actor=actor)
    _withdraw_unapproved_evidence(user, verification_case, company, actor=actor, event=event)
    recruiter.company = None
    recruiter.company_role = ''
    recruiter.save(update_fields=['company', 'company_role', 'updated_at'])
    record_admin_action(
        actor=actor,
        action='unlink_employer_company',
        target_type='user',
        target_public_id=user.public_id,
        payload={
            'event_public_id': event.public_id,
            'recruiter_public_id': recruiter.public_id,
            'company_public_id': company.public_id,
            'reason': normalized_reason,
        },
    )
    return event

"""Audited recovery for a recruiter linked to the wrong company."""

from __future__ import annotations

import hashlib
import json

from django.db import transaction
from django.db.models import Q

from apps.accounts.models import User
from apps.accounts.permissions import require_admin_permission
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
    RecruiterProfile,
    RecruitmentCampaign,
    RecruitmentNeed,
)
from .notifications import emit_employer_event

COMPANY_UNLINK_PERMISSION = 'employer_verification.unlink_company'
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


def _clean_snapshot(user, recruiter, verification_case, company):
    counts = {
        'company_documents': CompanyDocument.objects.filter(
            Q(recruiter=recruiter) | Q(uploaded_by=user)
        ).count(),
        'company_update_requests': CompanyUpdateRequest.objects.filter(requested_by=user).count(),
        'recruitment_needs': RecruitmentNeed.objects.filter(recruiter=recruiter).count(),
        'campaigns': RecruitmentCampaign.objects.filter(owner=recruiter).count(),
        'jobs': Job.objects.filter(posted_by=user).count(),
        'active_compliance_holds': EmployerComplianceHold.objects.filter(
            recruiter=recruiter,
            status=EmployerComplianceHold.Status.ACTIVE,
        ).count(),
        'verification_events': (
            verification_case.events.count() if verification_case is not None else 0
        ),
        'tax_lookup_evidence': (
            verification_case.tax_lookup_evidences.count() if verification_case is not None else 0
        ),
    }
    blockers = []
    if recruiter.company_role != RecruiterProfile.CompanyRole.MEMBER:
        blockers.append('COMPANY_OWNER_LINK')
    if verification_case is not None and (
        verification_case.company_id not in {None, company.pk}
        or verification_case.status != EmployerVerificationCase.Status.DRAFT
        or verification_case.verification_method
        or verification_case.submitted_at is not None
        or verification_case.reviewer_id is not None
        or verification_case.decided_at is not None
        or verification_case.decision_reason
        or verification_case.decision_source
    ):
        blockers.append('VERIFICATION_CASE_NOT_CLEAN')
    blocker_by_count = {
        'company_documents': 'COMPANY_DOCUMENTS_EXIST',
        'company_update_requests': 'COMPANY_UPDATE_REQUESTS_EXIST',
        'recruitment_needs': 'RECRUITMENT_NEEDS_EXIST',
        'campaigns': 'CAMPAIGNS_EXIST',
        'jobs': 'JOBS_EXIST',
        'active_compliance_holds': 'COMPLIANCE_HOLDS_EXIST',
        'verification_events': 'VERIFICATION_HISTORY_EXISTS',
        'tax_lookup_evidence': 'TAX_EVIDENCE_EXISTS',
    }
    blockers.extend(blocker_by_count[key] for key, count in counts.items() if count)
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
        'blockers': sorted(set(blockers)),
    }
    encoded = json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    snapshot['integrity_revision'] = int(hashlib.sha256(encoded.encode()).hexdigest()[:15], 16)
    return snapshot


def company_unlink_impact(user, *, actor, reason):
    require_admin_permission(actor, COMPANY_UNLINK_PERMISSION)
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
    require_admin_permission(actor, COMPANY_UNLINK_PERMISSION)
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
            'Liên kết đã phát sinh dữ liệu nghiệp vụ và không thể gỡ tự động.',
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
    recruiter.company = None
    recruiter.company_role = ''
    recruiter.save(update_fields=['company', 'company_role', 'updated_at'])
    if verification_case is not None:
        verification_case.company = None
        verification_case.lock_version += 1
        verification_case.save(update_fields=['company', 'lock_version', 'updated_at'])
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

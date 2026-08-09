"""Canonical employer capability readiness read model.

The policy in this module is intentionally split from the current database
adapter.  ER-6 can therefore introduce versioned DPA evidence without changing
the public readiness contract or duplicating capability rules in API views.
"""

from enum import StrEnum

from apps.accounts.models import User

from ..models import EmployerVerificationCase
from .onboarding import build_employer_onboarding_steps


class DpaStatus(StrEnum):
    """Stable public DPA lifecycle values, including future ER-6 states."""

    MISSING = 'missing'
    CURRENT = 'current'
    LEGACY_UNVERSIONED = 'legacy_unversioned'
    OUTDATED = 'outdated'
    GRACE = 'grace'
    HOLD = 'hold'
    UNKNOWN = 'unknown'


WORKSPACE_CAPABILITY = 'job_workspace'
VERIFICATION_CAPABILITY = 'verification'
CANDIDATE_DATA_CAPABILITY = 'candidate_data'
JOB_APPROVAL_CAPABILITY = 'job_approval'

WORKSPACE_DPA_STATUSES = {
    DpaStatus.CURRENT,
    DpaStatus.LEGACY_UNVERSIONED,
    DpaStatus.OUTDATED,
    DpaStatus.GRACE,
}


def _blocker(code, *, capabilities, message, action):
    return {
        'code': code,
        'capabilities': list(capabilities),
        'message': message,
        'action': action,
    }


def current_dpa_status(recruiter):
    """Adapt today's timestamp-only storage to the full DPA enum.

    The existing schema can prove only that an acceptance timestamp exists. It
    must not invent version/hash evidence or label old rows as legacy before
    the explicit ER-6 migration and rollout.
    """
    return DpaStatus.CURRENT if recruiter and recruiter.dpa_accepted_at else DpaStatus.MISSING


def evaluate_employer_readiness(
    *,
    account_state,
    account_accessible=None,
    initial_onboarding_complete,
    phone_verified,
    company_linked,
    business_document_submitted,
    candidate_dpa_submitted,
    verification_case_status,
    dpa_status,
):
    """Evaluate employer capabilities without reading settings or the database."""
    try:
        dpa_status = DpaStatus(dpa_status)
    except (TypeError, ValueError):
        dpa_status = DpaStatus.UNKNOWN

    account_known = account_state in User.Status.values
    if account_accessible is None:
        account_accessible = account_state == User.Status.ACTIVE
    account_accessible = bool(account_known and account_accessible)
    verification_approved = bool(
        account_accessible and verification_case_status == EmployerVerificationCase.Status.APPROVED
    )
    job_workspace_ready = bool(
        account_accessible
        and initial_onboarding_complete
        and phone_verified
        and company_linked
        and business_document_submitted
        and candidate_dpa_submitted
        and dpa_status in WORKSPACE_DPA_STATUSES
    )
    candidate_data_access = bool(
        job_workspace_ready and verification_approved and dpa_status == DpaStatus.CURRENT
    )

    blockers = []
    all_capabilities = (
        WORKSPACE_CAPABILITY,
        VERIFICATION_CAPABILITY,
        CANDIDATE_DATA_CAPABILITY,
        JOB_APPROVAL_CAPABILITY,
    )
    if not account_known:
        blockers.append(
            _blocker(
                'account_state_unknown',
                capabilities=all_capabilities,
                message='Không xác định được trạng thái tài khoản.',
                action='contact_support',
            )
        )
    elif not account_accessible:
        blockers.append(
            _blocker(
                'account_restricted',
                capabilities=all_capabilities,
                message='Tài khoản đang bị hạn chế.',
                action='contact_support',
            )
        )

    workspace_requirements = (
        (
            initial_onboarding_complete,
            'initial_onboarding_required',
            'Hoàn tất hồ sơ đăng ký, xác minh email và nhu cầu tuyển dụng.',
            'complete_onboarding',
        ),
        (
            phone_verified,
            'phone_verification_required',
            'Xác minh số điện thoại trước khi sử dụng workspace.',
            'verify_phone',
        ),
        (
            company_linked,
            'company_link_required',
            'Liên kết một công ty trước khi sử dụng workspace.',
            'link_company',
        ),
        (
            business_document_submitted,
            'business_document_required',
            'Nộp giấy tờ đại diện doanh nghiệp còn hiệu lực.',
            'upload_business_document',
        ),
        (
            candidate_dpa_submitted,
            'candidate_dpa_document_required',
            'Nộp thỏa thuận xử lý dữ liệu ứng viên.',
            'upload_candidate_dpa',
        ),
    )
    for complete, code, message, action in workspace_requirements:
        if not complete:
            blockers.append(
                _blocker(
                    code,
                    capabilities=(WORKSPACE_CAPABILITY, CANDIDATE_DATA_CAPABILITY),
                    message=message,
                    action=action,
                )
            )

    if not verification_approved:
        blockers.append(
            _blocker(
                'verification_required',
                capabilities=(
                    VERIFICATION_CAPABILITY,
                    CANDIDATE_DATA_CAPABILITY,
                    JOB_APPROVAL_CAPABILITY,
                ),
                message='Hồ sơ đại diện doanh nghiệp chưa được duyệt.',
                action='open_verification',
            )
        )

    dpa_blockers = {
        DpaStatus.MISSING: (
            'dpa_missing',
            (WORKSPACE_CAPABILITY, CANDIDATE_DATA_CAPABILITY, JOB_APPROVAL_CAPABILITY),
            'Chưa có chấp thuận DPA.',
            'accept_dpa',
        ),
        DpaStatus.LEGACY_UNVERSIONED: (
            'dpa_legacy_unversioned',
            (CANDIDATE_DATA_CAPABILITY, JOB_APPROVAL_CAPABILITY),
            'Chấp thuận DPA cũ chưa có phiên bản bằng chứng.',
            'accept_current_dpa',
        ),
        DpaStatus.OUTDATED: (
            'dpa_outdated',
            (CANDIDATE_DATA_CAPABILITY, JOB_APPROVAL_CAPABILITY),
            'Chấp thuận DPA không còn là phiên bản hiện hành.',
            'accept_current_dpa',
        ),
        DpaStatus.GRACE: (
            'dpa_grace',
            (CANDIDATE_DATA_CAPABILITY, JOB_APPROVAL_CAPABILITY),
            'DPA đang trong thời gian gia hạn cập nhật.',
            'accept_current_dpa',
        ),
        DpaStatus.HOLD: (
            'dpa_hold',
            (WORKSPACE_CAPABILITY, CANDIDATE_DATA_CAPABILITY, JOB_APPROVAL_CAPABILITY),
            'Tài khoản đang bị giữ do DPA quá hạn.',
            'accept_current_dpa',
        ),
        DpaStatus.UNKNOWN: (
            'dpa_unknown',
            (WORKSPACE_CAPABILITY, CANDIDATE_DATA_CAPABILITY, JOB_APPROVAL_CAPABILITY),
            'Không xác định được trạng thái DPA.',
            'contact_support',
        ),
    }
    if dpa_status in dpa_blockers:
        code, capabilities, message, action = dpa_blockers[dpa_status]
        blockers.append(
            _blocker(
                code,
                capabilities=capabilities,
                message=message,
                action=action,
            )
        )

    return {
        'job_workspace_ready': job_workspace_ready,
        'verification_approved': verification_approved,
        'candidate_data_access': candidate_data_access,
        'dpa_status': dpa_status.value,
        'blockers': blockers,
    }


def build_employer_readiness(recruiter, *, onboarding=None, dpa_status=None):
    """Build the canonical readiness DTO from current employer records."""
    if recruiter is None:
        return evaluate_employer_readiness(
            account_state=None,
            account_accessible=False,
            initial_onboarding_complete=False,
            phone_verified=False,
            company_linked=False,
            business_document_submitted=False,
            candidate_dpa_submitted=False,
            verification_case_status=None,
            dpa_status=DpaStatus.UNKNOWN,
        )
    onboarding = onboarding or build_employer_onboarding_steps(recruiter)
    try:
        verification_case_status = recruiter.verification_case.status
    except EmployerVerificationCase.DoesNotExist:
        verification_case_status = None
    return evaluate_employer_readiness(
        account_state=recruiter.user.status,
        account_accessible=(
            recruiter.user.status == User.Status.ACTIVE
            and recruiter.user.is_active
            and not recruiter.user.is_deleted
        ),
        initial_onboarding_complete=onboarding['account_ready'],
        phone_verified=onboarding['phone_verified'],
        company_linked=onboarding['company_linked'],
        business_document_submitted=onboarding['business_doc_submitted'],
        candidate_dpa_submitted=onboarding['candidate_dpa_submitted'],
        verification_case_status=verification_case_status,
        dpa_status=dpa_status if dpa_status is not None else current_dpa_status(recruiter),
    )

"""Employer readiness policy and model-level evidence query helpers.

Keeping the pure policy below both selectors and services prevents write
guards from depending on presentation/query modules while preserving one
authoritative capability decision table.
"""

from enum import StrEnum

from django.db.models import Exists, OuterRef, Q

from apps.accounts.models import User

from .verification import EmployerVerificationCase


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
    """Adapt today's timestamp-only storage to the full DPA enum."""
    return DpaStatus.CURRENT if recruiter and recruiter.dpa_accepted_at else DpaStatus.MISSING


def is_registration_placeholder_company(recruiter, *, has_company_industry=None):
    """Recognise sparse companies created by the retired registration shortcut."""
    if recruiter.company_id is None:
        return False
    company = recruiter.company
    return (
        company.created_by_id == recruiter.user_id
        and recruiter.company_role == recruiter.CompanyRole.OWNER
        and company.tax_code is None
        and company.has_no_logo
        and company.has_no_website
        and not (
            bool(has_company_industry)
            if has_company_industry is not None
            else company.company_industries.exists()
        )
    )


def has_explicit_company_link(recruiter, *, has_company_industry=None):
    return recruiter.company_id is not None and not is_registration_placeholder_company(
        recruiter,
        has_company_industry=has_company_industry,
    )


def employer_readiness_queryset():
    """Recruiter rows annotated with every current workspace evidence predicate."""
    # Local imports keep Django model package initialisation acyclic.
    from .company import CompanyIndustry
    from .compliance import EmployerComplianceHold
    from .membership import RecruiterProfile
    from .recruitment_need import RecruitmentNeed
    from .verification import CompanyDocument

    owned_documents = (
        Q(
            verification_case__recruiter_id=OuterRef('pk'),
        )
        | Q(
            verification_case__isnull=True,
            update_request__isnull=True,
            recruiter_id=OuterRef('pk'),
        )
        | Q(
            verification_case__isnull=True,
            update_request__isnull=True,
            recruiter__isnull=True,
            uploaded_by_id=OuterRef('user_id'),
        )
    )
    current_documents = CompanyDocument.objects.filter(
        owned_documents,
        company_id=OuterRef('company_id'),
        is_current=True,
    ).exclude(status=CompanyDocument.Status.REJECTED)
    business_types = (
        CompanyDocument.DocType.AUTHORIZATION_LETTER,
        CompanyDocument.DocType.BUSINESS_REGISTRATION,
        CompanyDocument.DocType.IDENTITY_DOCUMENT,
    )
    return RecruiterProfile.objects.select_related(
        'user',
        'company',
        'verification_case',
    ).annotate(
        readiness_has_recruitment_need=Exists(
            RecruitmentNeed.objects.filter(recruiter_id=OuterRef('pk'))
        ),
        readiness_has_business_document=Exists(
            current_documents.filter(doc_type__in=business_types)
        ),
        readiness_has_candidate_dpa=Exists(
            current_documents.filter(doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT)
        ),
        readiness_has_company_industry=Exists(
            CompanyIndustry.objects.filter(company_id=OuterRef('company_id'))
        ),
        readiness_has_active_compliance_hold=Exists(
            EmployerComplianceHold.objects.filter(
                recruiter_id=OuterRef('pk'),
                status=EmployerComplianceHold.Status.ACTIVE,
            )
        ),
    )


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
    compliance_hold_active=False,
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
        job_workspace_ready
        and verification_approved
        and dpa_status == DpaStatus.CURRENT
        and not compliance_hold_active
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

    if compliance_hold_active:
        blockers.append(
            _blocker(
                'compliance_hold_active',
                capabilities=(CANDIDATE_DATA_CAPABILITY, JOB_APPROVAL_CAPABILITY),
                message='Tài khoản đang có một giới hạn tuân thủ còn hiệu lực.',
                action='open_compliance',
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
        'compliance_hold_active': bool(compliance_hold_active),
        'dpa_status': dpa_status.value,
        'blockers': blockers,
    }


def missing_employer_readiness():
    """Return a deterministic fail-closed state for an absent recruiter row."""
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


def build_annotated_employer_readiness(recruiter, *, dpa_status=None):
    """Build readiness from a row returned by ``employer_readiness_queryset``."""
    if recruiter is None:
        return missing_employer_readiness()
    try:
        verification_case = recruiter.verification_case
        verification_case_status = (
            verification_case.status
            if verification_case.company_id == recruiter.company_id
            else None
        )
    except EmployerVerificationCase.DoesNotExist:
        verification_case_status = None
    return evaluate_employer_readiness(
        account_state=recruiter.user.status,
        account_accessible=(
            recruiter.user.status == User.Status.ACTIVE
            and recruiter.user.is_active
            and not recruiter.user.is_deleted
        ),
        initial_onboarding_complete=bool(
            recruiter.registration_completed_at is not None
            and recruiter.user.email_verified
            and recruiter.readiness_has_recruitment_need
        ),
        phone_verified=recruiter.phone_verified_at is not None,
        company_linked=has_explicit_company_link(
            recruiter,
            has_company_industry=recruiter.readiness_has_company_industry,
        ),
        business_document_submitted=recruiter.readiness_has_business_document,
        candidate_dpa_submitted=recruiter.readiness_has_candidate_dpa,
        verification_case_status=verification_case_status,
        dpa_status=dpa_status if dpa_status is not None else current_dpa_status(recruiter),
        compliance_hold_active=getattr(
            recruiter,
            'readiness_has_active_compliance_hold',
            False,
        ),
    )

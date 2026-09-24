"""Recruiter profile workflows."""

from http import HTTPStatus

from django.conf import settings
from rest_framework.exceptions import APIException

from apps.accounts.models import User

from ..models import Company, CompanyDocument, EmployerVerificationCase, RecruiterProfile
from ..models.readiness import (
    build_annotated_employer_readiness,
    employer_readiness_queryset,
    missing_employer_readiness,
)

JOB_APPROVAL_VERIFICATION_BLOCKER = {
    'code': 'verification_required',
    'label': 'Nhà tuyển dụng chưa được duyệt xác thực.',
}
JOB_APPROVAL_DPA_BLOCKER = {
    'code': 'dpa_outdated',
    'label': 'Nhà tuyển dụng chưa có chấp thuận DPA còn hiệu lực.',
}
JOB_APPROVAL_COMPLIANCE_HOLD_BLOCKER = {
    'code': 'compliance_hold_active',
    'label': 'Nhà tuyển dụng đang có một giới hạn tuân thủ còn hiệu lực.',
}


class EmployerCapabilityBlocked(APIException):
    """Base machine-readable capability failure returned by employer guards."""

    status_code = HTTPStatus.FORBIDDEN
    capability = ''
    action = 'open_compliance'

    def __init__(self, *, code, message, readiness):
        blockers = [
            blocker
            for blocker in readiness['blockers']
            if self.capability in blocker['capabilities']
        ]
        super().__init__(
            detail={
                'code': code,
                'message': message,
                'action': self.action,
                'blockers': blockers,
            },
            code=code,
        )


class EmployerWorkspaceBlocked(EmployerCapabilityBlocked):
    capability = 'job_workspace'

    def __init__(self, readiness):
        super().__init__(
            code='EMPLOYER_WORKSPACE_BLOCKED',
            message='Hoàn tất các điều kiện workspace trước khi thay đổi dữ liệu tuyển dụng.',
            readiness=readiness,
        )


class CandidateDataBlocked(EmployerCapabilityBlocked):
    capability = 'candidate_data'

    def __init__(self, readiness):
        super().__init__(
            code='CANDIDATE_DATA_BLOCKED',
            message='Tài khoản chưa đủ điều kiện truy cập dữ liệu ứng viên.',
            readiness=readiness,
        )


def recruiter_readiness_state(user, *, lock=False):
    """Return recruiter + canonical state, optionally locking U → R → V."""
    resolved_user = user
    if lock:
        resolved_user = User.objects.select_for_update(of=('self',)).get(pk=user.pk)
    recruiter_queryset = employer_readiness_queryset().filter(user_id=resolved_user.pk)
    if lock:
        recruiter_queryset = recruiter_queryset.select_for_update(of=('self',))
    recruiter = recruiter_queryset.first()
    if recruiter is None:
        return None, missing_employer_readiness()
    # ``select_related`` reads the case for non-locking presenters. A write
    # boundary must explicitly lock that same row before Campaign/Job/Application.
    if lock:
        verification_case = (
            EmployerVerificationCase.objects.select_for_update(of=('self',))
            .filter(recruiter_id=recruiter.pk)
            .first()
        )
        recruiter._state.fields_cache['verification_case'] = verification_case
    return recruiter, build_annotated_employer_readiness(recruiter)


def ensure_recruiter_job_workspace(user, *, lock=False):
    recruiter, readiness = recruiter_readiness_state(user, lock=lock)
    if not readiness['job_workspace_ready']:
        raise EmployerWorkspaceBlocked(readiness)
    return recruiter, readiness


def get_or_create_recruiter(user):
    recruiter, _ = RecruiterProfile.objects.get_or_create(user=user)
    return recruiter


def _legacy_verification_completed(readiness):
    completed = readiness['job_workspace_ready']
    if getattr(settings, 'REQUIRE_APPROVED_EMPLOYER_VERIFICATION', False):
        completed = completed and readiness['verification_approved']
    return completed


def recruiter_posting_readiness(user):
    """Return the compatibility readiness bit from the canonical policy state."""
    recruiter, readiness = recruiter_readiness_state(user)
    return recruiter, _legacy_verification_completed(readiness)


def recruiter_job_posting_entitlement(user):
    """Return the account-level conditions required for the 100-job quota.

    Recruiters who have not reached this entitlement still retain their
    separate introductory quota. The final job-posting service enforces the
    appropriate limit under a transaction.
    """
    recruiter, readiness = recruiter_readiness_state(user)
    verification_completed = _legacy_verification_completed(readiness)
    if recruiter is None or recruiter.company_id is None:
        return recruiter, {
            'verification_completed': False,
            'admin_approved': False,
            'dpa_current': False,
            'account_level': 0,
            'verified_job_quota_eligible': False,
        }

    try:
        verification_case = recruiter.verification_case
    except EmployerVerificationCase.DoesNotExist:
        verification_case = None
    admin_approved = readiness['verification_approved']
    business_document_approved = False
    if verification_case is not None:
        business_documents = CompanyDocument.objects.filter(
            verification_case=verification_case,
            company_id=recruiter.company_id,
            is_current=True,
            status=CompanyDocument.Status.APPROVED,
        )
        if (
            verification_case.verification_method
            == EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID
        ):
            approved_types = set(
                business_documents.filter(
                    doc_type__in=(
                        CompanyDocument.DocType.AUTHORIZATION_LETTER,
                        CompanyDocument.DocType.IDENTITY_DOCUMENT,
                    )
                ).values_list('doc_type', flat=True)
            )
            business_document_approved = approved_types == {
                CompanyDocument.DocType.AUTHORIZATION_LETTER,
                CompanyDocument.DocType.IDENTITY_DOCUMENT,
            }
        else:
            business_document_approved = business_documents.filter(
                doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION
            ).exists()

    account_level = 0
    if recruiter.user.email_verified:
        account_level = 1
    phone_verified = bool(
        recruiter.phone_verified_at
        and recruiter.verified_phone
        and recruiter.contact_phone == recruiter.verified_phone
        and recruiter.user.phone == recruiter.verified_phone
    )
    if account_level == 1 and phone_verified and business_document_approved:
        account_level = 2
    if account_level == 2 and admin_approved:
        account_level = 3

    return recruiter, {
        'verification_completed': verification_completed,
        'admin_approved': admin_approved,
        'dpa_current': readiness['dpa_status'] == 'current',
        'account_level': account_level,
        'verified_job_quota_eligible': (
            verification_completed
            and admin_approved
            and readiness['dpa_status'] == 'current'
            and account_level >= 3
        ),
    }


def recruiter_job_approval_state(user, *, company_id, lock=False):
    """Return the fail-closed policy state used by administrator job approval.

    Job approval is intentionally stricter than job-workspace readiness: the
    recruiter must have an approved, account-scoped verification case for the
    company publishing the job and a current platform DPA acceptance. ``lock``
    is used by the write workflow so concurrent verification/DPA transitions
    are serialized with the final approval decision.
    """
    recruiter, readiness = recruiter_readiness_state(user, lock=lock)
    company_matches = bool(recruiter and recruiter.company_id == company_id)
    if lock and company_id is not None:
        company_matches = bool(
            Company.objects.select_for_update(of=('self',)).filter(pk=company_id).exists()
            and company_matches
        )
    verification_approved = bool(company_matches and readiness['verification_approved'])
    dpa_current = readiness['dpa_status'] == 'current'
    compliance_hold_active = readiness['compliance_hold_active']
    blockers = []
    if not verification_approved:
        blockers.append(dict(JOB_APPROVAL_VERIFICATION_BLOCKER))
    if not dpa_current:
        blockers.append(dict(JOB_APPROVAL_DPA_BLOCKER))
    if compliance_hold_active:
        blockers.append(dict(JOB_APPROVAL_COMPLIANCE_HOLD_BLOCKER))

    return {
        'verification_approved': verification_approved,
        'dpa_current': dpa_current,
        'compliance_hold_active': compliance_hold_active,
        'approve_blockers': blockers,
    }


def ensure_recruiter_candidate_data_access(user, *, lock=False):
    """Enforce the rollout gate before exposing candidate personal data."""
    recruiter, readiness = recruiter_readiness_state(user, lock=lock)
    if not readiness['candidate_data_access']:
        raise CandidateDataBlocked(readiness)
    return recruiter, readiness


def recruiter_candidate_data_access_allowed(user):
    """Return whether personal candidate data may be included in a response."""
    _, readiness = recruiter_readiness_state(user)
    return readiness['candidate_data_access']

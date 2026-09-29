"""Canonical recruiter trust-badge eligibility policy.

This service owns the cross-domain decision. Candidate-facing job serializers
adapt it through the jobs selector; employer self APIs expose the full result.
"""

from calendar import monthrange

from django.conf import settings
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.services import is_account_accessible
from apps.jobs.models import JobReport
from apps.sitecontent.models import SiteSetting
from common.metrics import record_metric

from ..models import (
    CompanyDocument,
    CompanyDomainClaim,
    EmployerVerificationCase,
    RecruiterProfile,
)
from .domain_claims import DomainClaimError, verified_email_domain

MINIMUM_ACCOUNT_MONTHS_SETTING = 'employer_badge_min_account_months'
DEFAULT_MINIMUM_ACCOUNT_MONTHS = 6
MINIMUM_ACCOUNT_MONTHS_LIMIT = 1
MAXIMUM_ACCOUNT_MONTHS_LIMIT = 60

TRUST_REPORT_REASONS = (
    JobReport.Reason.FAKE_COMPANY,
    JobReport.Reason.SCAM,
    JobReport.Reason.WRONG_INFO,
)

BADGE_CRITERIA = (
    (
        'email_domain_verified',
        'Đã xác thực email tên miền công ty',
        'verify_company_domain',
    ),
    ('phone_verified', 'Đã xác thực số điện thoại', 'verify_phone'),
    (
        'business_doc_approved',
        'Hồ sơ pháp lý và quyền đại diện đã được duyệt',
        'complete_legal_verification',
    ),
    (
        'account_age_reached',
        'Tài khoản nhà tuyển dụng đã đạt tuổi tối thiểu',
        'wait_for_account_age',
    ),
    (
        'no_report_history',
        'Chưa có tin đăng vi phạm được quản trị viên xác nhận',
        'review_confirmed_reports',
    ),
)


def _minimum_account_months():
    value = (
        SiteSetting.objects.filter(key=MINIMUM_ACCOUNT_MONTHS_SETTING)
        .values_list('value', flat=True)
        .first()
    )
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or not MINIMUM_ACCOUNT_MONTHS_LIMIT <= value <= MAXIMUM_ACCOUNT_MONTHS_LIMIT
    ):
        return DEFAULT_MINIMUM_ACCOUNT_MONTHS
    return value


def _add_calendar_months(value, months):
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def account_badge_eligible_at(user, minimum_months):
    return _add_calendar_months(user.date_joined, minimum_months)


def _approved_document_exists(doc_type):
    return Exists(
        CompanyDocument.objects.filter(
            verification_case_id=OuterRef('verification_case'),
            company_id=OuterRef('company_id'),
            is_current=True,
            status=CompanyDocument.Status.APPROVED,
            doc_type=doc_type,
        )
    )


def _recruiters_for_badge(*, company_ids, user_ids):
    trust_violation = JobReport.objects.filter(
        posted_by_id_snapshot=OuterRef('user_id'),
        status=JobReport.Status.UPHELD,
        reason__in=TRUST_REPORT_REASONS,
    )
    return (
        RecruiterProfile.objects.filter(
            company_id__in=company_ids,
            user_id__in=user_ids,
        )
        .select_related('user', 'verification_case')
        .annotate(
            has_business_registration=_approved_document_exists(
                CompanyDocument.DocType.BUSINESS_REGISTRATION
            ),
            has_authorization=_approved_document_exists(
                CompanyDocument.DocType.AUTHORIZATION_LETTER
            ),
            has_identity_document=_approved_document_exists(
                CompanyDocument.DocType.IDENTITY_DOCUMENT
            ),
            has_trust_violation=Exists(trust_violation),
        )
    )


def _legal_documents_approved(recruiter):
    try:
        case = recruiter.verification_case
    except EmployerVerificationCase.DoesNotExist:
        return False
    if (
        case.company_id != recruiter.company_id
        or case.status != EmployerVerificationCase.Status.APPROVED
    ):
        return False
    if (
        case.verification_method
        == EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
    ):
        return recruiter.has_business_registration
    if case.verification_method == EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID:
        return recruiter.has_authorization and recruiter.has_identity_document
    return False


def _empty_state(*, minimum_months, eligible_at=None):
    state = {key: False for key, _, _ in BADGE_CRITERIA}
    state.update(
        {
            'verified': False,
            'minimum_account_months': minimum_months,
            'eligible_at': eligible_at,
            'legacy_verified': False,
            'policy_verified': False,
        }
    )
    return state


def employer_badge_state_map(badge_keys):
    """Bulk-evaluate exact ``(company_id, employer_user_id)`` pairs."""
    keys = {(company_id, user_id) for company_id, user_id in badge_keys if company_id and user_id}
    if not keys:
        return {}

    minimum_months = _minimum_account_months()
    company_ids = {company_id for company_id, _ in keys}
    user_ids = {user_id for _, user_id in keys}
    recruiters = list(_recruiters_for_badge(company_ids=company_ids, user_ids=user_ids))
    now = timezone.now()
    verified_domains = set(
        CompanyDomainClaim.objects.filter(
            company_id__in=company_ids,
        )
        .filter(
            Q(status=CompanyDomainClaim.Status.GRACE, grace_expires_at__gt=now)
            | Q(status=CompanyDomainClaim.Status.VERIFIED)
            & (Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        )
        .values_list('company_id', 'domain')
    )

    states = {key: _empty_state(minimum_months=minimum_months) for key in keys}
    for recruiter in recruiters:
        key = (recruiter.company_id, recruiter.user_id)
        if key not in states:
            continue
        user = recruiter.user
        eligible_at = account_badge_eligible_at(user, minimum_months)
        try:
            current_domain = verified_email_domain(user)
        except DomainClaimError:
            current_domain = ''
        state = {
            'email_domain_verified': bool(
                current_domain and (recruiter.company_id, current_domain) in verified_domains
            ),
            'phone_verified': bool(
                recruiter.phone_verified_at
                and recruiter.verified_phone
                and recruiter.contact_phone == recruiter.verified_phone
                and user.phone == recruiter.verified_phone
            ),
            'business_doc_approved': _legal_documents_approved(recruiter),
            'account_age_reached': now >= eligible_at,
            'no_report_history': not recruiter.has_trust_violation,
            'minimum_account_months': minimum_months,
            'eligible_at': eligible_at,
        }
        invariants_hold = bool(
            is_account_accessible(user)
            and user.role == User.Role.EMPLOYER
            and recruiter.company_id == key[0]
        )
        try:
            case = recruiter.verification_case
        except EmployerVerificationCase.DoesNotExist:
            case = None
        state['legacy_verified'] = bool(
            invariants_hold
            and case
            and case.company_id == recruiter.company_id
            and case.status == EmployerVerificationCase.Status.APPROVED
        )
        state['policy_verified'] = invariants_hold and all(
            state[key] for key, _, _ in BADGE_CRITERIA
        )
        mode = getattr(settings, 'EMPLOYER_BADGE_POLICY_MODE', 'shadow').strip().lower()
        state['verified'] = (
            state['policy_verified'] if mode == 'enforce' else state['legacy_verified']
        )
        states[key] = state

    if getattr(settings, 'EMPLOYER_BADGE_POLICY_MODE', 'shadow') == 'shadow':
        cohorts = {}
        for state in states.values():
            cohort = (state['legacy_verified'], state['policy_verified'])
            cohorts[cohort] = cohorts.get(cohort, 0) + 1
        for (legacy_verified, policy_verified), count in cohorts.items():
            record_metric(
                'employer_badge_policy_shadow',
                count,
                legacy_verified=str(legacy_verified).lower(),
                policy_verified=str(policy_verified).lower(),
            )
    return states


def employer_badge_payload(state, *, expose_failures):
    criteria = [
        {
            'key': key,
            'label': label,
            'passed': state[key],
            **({'action': action} if expose_failures else {}),
        }
        for key, label, action in BADGE_CRITERIA
    ]
    payload = {
        'verified': state['verified'],
        # Public consumers must never receive trust signals when the response
        # itself says the recruiter is unverified.  Requiring both bits also
        # keeps the compatibility ``shadow`` mode from exposing a contradictory
        # payload during rollout.
        'criteria': (
            criteria if expose_failures or (state['verified'] and state['policy_verified']) else []
        ),
    }
    if expose_failures:
        payload.update(
            {
                'minimum_account_months': state['minimum_account_months'],
                'eligible_at': state['eligible_at'],
            }
        )
    return payload


def recruiter_badge_eligibility(recruiter):
    if recruiter is None or recruiter.company_id is None or recruiter.user_id is None:
        state = _empty_state(minimum_months=_minimum_account_months())
    else:
        state = employer_badge_state_map({(recruiter.company_id, recruiter.user_id)})[
            (recruiter.company_id, recruiter.user_id)
        ]
    return employer_badge_payload(state, expose_failures=True)

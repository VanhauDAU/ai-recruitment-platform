"""Read model for recruiter onboarding and account-verification progress."""

from django.conf import settings
from django.db.models import Q

from apps.jobs.models import JobReport
from common.company_email import email_domain

from ..models import CompanyDocument, DpaStatus, EmployerVerificationCase
from ..models.readiness import current_dpa_status
from .company_status import has_explicit_company_link
from .domain_claims import effective_company_domain_claims

INITIAL_ONBOARDING_STEP_LABELS = {
    'registration_completed': 'Hồ sơ đăng ký',
    'email_verified': 'Xác minh email',
    'consulting_need_completed': 'Nhu cầu tuyển dụng',
}


def build_employer_initial_onboarding(recruiter, *, has_recruitment_need=None):
    """Derive the three steps that gate access to the employer application."""
    if has_recruitment_need is None:
        prefetched_needs = getattr(recruiter, 'verification_recruitment_needs', None)
        has_recruitment_need = (
            bool(prefetched_needs)
            if prefetched_needs is not None
            else recruiter.recruitment_needs.exists()
        )
    steps = {
        'registration_completed': recruiter.registration_completed_at is not None,
        'email_verified': recruiter.user.email_verified,
        'consulting_need_completed': bool(has_recruitment_need),
    }
    missing_steps = [key for key, completed in steps.items() if not completed]
    return {
        'completed': not missing_steps,
        'steps': steps,
        'missing_steps': missing_steps,
        'missing_step_labels': [INITIAL_ONBOARDING_STEP_LABELS[key] for key in missing_steps],
    }


def build_employer_onboarding_steps(recruiter, *, badge_eligibility=None):
    """Derive every onboarding/checklist state from its canonical record."""
    initial_onboarding = build_employer_initial_onboarding(recruiter)
    company_linked = has_explicit_company_link(recruiter)
    case = getattr(recruiter, 'verification_case', None)
    # Verification evidence is account-scoped. A recruiter joining an existing
    # company must never inherit documents uploaded by another recruiter.
    owned_documents = Q(
        verification_case__isnull=True,
        update_request__isnull=True,
        recruiter=recruiter,
    ) | Q(
        verification_case__isnull=True,
        update_request__isnull=True,
        recruiter__isnull=True,
        uploaded_by=recruiter.user,
    )
    if case is not None:
        owned_documents |= Q(verification_case=case)
    case_documents = CompanyDocument.objects.filter(
        owned_documents,
        company_id=recruiter.company_id,
        is_current=True,
    )
    business_types = {
        CompanyDocument.DocType.AUTHORIZATION_LETTER,
        CompanyDocument.DocType.BUSINESS_REGISTRATION,
        CompanyDocument.DocType.IDENTITY_DOCUMENT,
    }
    has_business_doc = (
        case_documents.filter(doc_type__in=business_types)
        .exclude(status=CompanyDocument.Status.REJECTED)
        .exists()
    )
    approved_business_types = set(
        case_documents.filter(
            doc_type__in=business_types,
            status=CompanyDocument.Status.APPROVED,
        ).values_list('doc_type', flat=True)
    )
    if (
        case is not None
        and case.verification_method
        == EmployerVerificationCase.VerificationMethod.AUTHORIZATION_AND_ID
    ):
        has_approved_business_doc = {
            CompanyDocument.DocType.AUTHORIZATION_LETTER,
            CompanyDocument.DocType.IDENTITY_DOCUMENT,
        }.issubset(approved_business_types)
    else:
        has_approved_business_doc = (
            CompanyDocument.DocType.BUSINESS_REGISTRATION in approved_business_types
        )
    has_candidate_dpa = (
        case_documents.filter(
            doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        )
        .exclude(
            status=CompanyDocument.Status.REJECTED,
        )
        .exists()
    )
    has_approved_candidate_dpa = case_documents.filter(
        doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
        status=CompanyDocument.Status.APPROVED,
    ).exists()
    case_approved = case is not None and case.status == EmployerVerificationCase.Status.APPROVED
    if badge_eligibility is None:
        domain = email_domain(recruiter.user.email) if recruiter.user.email_verified else ''
        badge_criteria = {
            'email_domain_verified': bool(
                recruiter.company_id
                and domain
                and effective_company_domain_claims(
                    company_id=recruiter.company_id,
                    domain=domain,
                ).exists()
            ),
            'phone_verified': bool(
                recruiter.phone_verified_at
                and recruiter.verified_phone
                and recruiter.contact_phone == recruiter.verified_phone
                and recruiter.user.phone == recruiter.verified_phone
            ),
            'no_report_history': not JobReport.objects.filter(
                posted_by_id_snapshot=recruiter.user_id,
                status=JobReport.Status.UPHELD,
                reason__in=(
                    JobReport.Reason.FAKE_COMPANY,
                    JobReport.Reason.SCAM,
                    JobReport.Reason.WRONG_INFO,
                ),
            ).exists(),
        }
    else:
        badge_criteria = {item['key']: item['passed'] for item in badge_eligibility['criteria']}
    steps = {
        **initial_onboarding['steps'],
        'phone_verified': badge_criteria['phone_verified'],
        'company_linked': company_linked,
        'business_doc_submitted': has_business_doc,
        'business_doc_approved': has_approved_business_doc,
        'email_domain_verified': badge_criteria['email_domain_verified'],
        'no_report_history': badge_criteria['no_report_history'],
        'candidate_dpa_submitted': has_candidate_dpa,
        'candidate_dpa_approved': has_approved_candidate_dpa,
        'dpa_accepted': current_dpa_status(recruiter) == DpaStatus.CURRENT,
        'representative_verified': case_approved,
        'first_job_posted': recruiter.user.posted_jobs.exists(),
    }
    steps['account_ready'] = initial_onboarding['completed']
    # Xác thực tài khoản hoàn tất sau năm workflow bảo mật/pháp lý đang khả
    # dụng. Đăng tin đầu tiên là bước kích hoạt sản phẩm riêng và chưa được dùng
    # để buộc một tài khoản đã xác thực quay lại checklist ở mỗi lần đăng nhập.
    legacy_completed = all(
        [
            steps['account_ready'],
            steps['phone_verified'],
            steps['company_linked'],
            steps['business_doc_submitted'],
            steps['candidate_dpa_submitted'],
            steps['dpa_accepted'],
        ]
    )
    steps['verification_completed'] = (
        case_approved
        if getattr(settings, 'REQUIRE_APPROVED_EMPLOYER_VERIFICATION', False)
        else legacy_completed
    )
    steps['completed'] = steps['verification_completed'] and steps['first_job_posted']
    return steps

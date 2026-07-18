"""Read model for recruiter onboarding and account-verification progress."""

from ..models import CompanyDocument, RecruiterProfile
from .company_status import has_explicit_company_link


def build_employer_onboarding_steps(recruiter):
    """Derive every onboarding/checklist state from its canonical record."""
    company_linked = has_explicit_company_link(recruiter)
    has_business_doc = company_linked and recruiter.company.documents.filter(
        doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
    ).exclude(status=CompanyDocument.Status.REJECTED).exists()
    has_candidate_dpa = company_linked and recruiter.company.documents.filter(
        doc_type=CompanyDocument.DocType.DATA_PROCESSING_AGREEMENT,
    ).exclude(status=CompanyDocument.Status.REJECTED).exists()
    steps = {
        'email_verified': recruiter.user.email_verified,
        'registration_completed': recruiter.registration_completed_at is not None,
        'consulting_need_completed': hasattr(recruiter, 'recruitment_need'),
        'phone_verified': recruiter.phone_verified_at is not None,
        'company_linked': company_linked,
        'membership_approved': company_linked and recruiter.membership_status == RecruiterProfile.MembershipStatus.APPROVED,
        'business_doc_submitted': has_business_doc,
        'candidate_dpa_submitted': has_candidate_dpa,
        'dpa_accepted': recruiter.dpa_accepted_at is not None,
        'first_job_posted': recruiter.user.posted_jobs.exists(),
    }
    steps['account_ready'] = all([
        steps['email_verified'],
        steps['registration_completed'],
        steps['consulting_need_completed'],
    ])
    steps['completed'] = all([
        steps['account_ready'],
        steps['phone_verified'],
        steps['company_linked'],
        steps['membership_approved'],
        steps['business_doc_submitted'],
        steps['candidate_dpa_submitted'],
        steps['dpa_accepted'],
        steps['first_job_posted'],
    ])
    return steps

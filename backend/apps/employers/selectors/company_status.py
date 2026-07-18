"""Read-only company-link status shared by onboarding and membership flows."""


def is_registration_placeholder_company(recruiter):
    """Recognise companies created by the retired registration shortcut.

    Older registrations created a sparse company before the recruiter had
    explicitly searched for or created one. Such a record must not complete
    the company-verification step or block the explicit company flow.
    """
    if recruiter.company_id is None:
        return False
    company = recruiter.company
    return (
        company.created_by_id == recruiter.user_id
        and recruiter.company_role == recruiter.CompanyRole.OWNER
        and recruiter.membership_status == recruiter.MembershipStatus.APPROVED
        and company.tax_code is None
        and company.has_no_logo
        and company.has_no_website
        and not company.company_industries.exists()
    )


def has_explicit_company_link(recruiter):
    return recruiter.company_id is not None and not is_registration_placeholder_company(recruiter)

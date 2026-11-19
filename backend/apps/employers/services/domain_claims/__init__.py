"""Company domain claims: DNS TXT proof by a recruiter, manual admin review and periodic recheck."""

from .claims import (
    create_domain_claim,
    reconcile_domain_claim,
    request_manual_domain_review,
    rotate_domain_claim,
    verify_domain_claim,
)
from .domains import (
    DomainClaimError,
    domain_claim_txt_name,
    normalize_company_domain,
    verified_email_domain,
)
from .review import (
    confirm_domain_claim_admin_action,
    domain_claim_admin_impact,
)

__all__ = [
    'DomainClaimError',
    'confirm_domain_claim_admin_action',
    'create_domain_claim',
    'domain_claim_admin_impact',
    'domain_claim_txt_name',
    'normalize_company_domain',
    'reconcile_domain_claim',
    'request_manual_domain_review',
    'rotate_domain_claim',
    'verified_email_domain',
    'verify_domain_claim',
]

"""Read-only compatibility exports for company-link status."""

from ..models.readiness import has_explicit_company_link, is_registration_placeholder_company

__all__ = ['has_explicit_company_link', 'is_registration_placeholder_company']

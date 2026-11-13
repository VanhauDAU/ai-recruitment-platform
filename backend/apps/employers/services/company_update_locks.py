"""Canonical row-lock order for the current company-update workflow."""

from rest_framework.exceptions import ValidationError

from ..models import Company, CompanyUpdateRequest


def lock_company_update_request(*, company_id, update_request_id):
    """Lock ``Company`` before its update request in every mutation path."""
    company = Company.objects.select_for_update().get(pk=company_id)
    update_request = CompanyUpdateRequest.objects.select_for_update().get(pk=update_request_id)
    if update_request.company_id != company.pk:
        raise ValidationError({'detail': 'Yêu cầu cập nhật không còn thuộc công ty đã khóa.'})
    return company, update_request

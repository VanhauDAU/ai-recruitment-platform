"""Company mutation and review workflows."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import Company, CompanyDocument, CompanyIndustry, Industry

UPDATABLE_COMPANY_FIELDS = {
    'business_type', 'tax_code', 'company_name', 'trade_name',
    'trade_name_same_as_registered', 'website_url', 'has_no_website', 'email',
    'phone', 'address', 'company_size', 'description', 'employee_benefits',
    'markets', 'target_customers', 'founded_year',
}
SENSITIVE_FIELDS = {'tax_code', 'company_name'}


@transaction.atomic
def set_company_industries(company, industries, primary_industry):
    """Replace a company's industry assignments atomically."""
    company.company_industries.all().delete()
    CompanyIndustry.objects.bulk_create([
        CompanyIndustry(
            company=company,
            industry=industry,
            is_primary=industry == primary_industry,
        )
        for industry in industries
    ])


@transaction.atomic
def apply_update_request(update_request, admin_user, approve, note=''):
    """Review an update request and atomically apply approved changes."""
    if update_request.status != update_request.Status.PENDING:
        raise ValidationError({'detail': 'Yêu cầu này đã được xử lý.'})

    if approve:
        if update_request.is_sensitive:
            document_types = set(update_request.documents.values_list('doc_type', flat=True))
            if update_request.proof_type == update_request.ProofType.BUSINESS_REGISTRATION:
                complete = CompanyDocument.DocType.BUSINESS_REGISTRATION in document_types
            else:
                complete = {
                    CompanyDocument.DocType.AUTHORIZATION_LETTER,
                    CompanyDocument.DocType.IDENTITY_DOCUMENT,
                }.issubset(document_types)
            if not complete:
                raise ValidationError({'detail': 'Yêu cầu nhạy cảm chưa có đủ giấy tờ chứng minh.'})
        company = update_request.company
        changes = dict(update_request.changes)
        industry_ids = changes.pop('industries', None)
        primary_id = changes.pop('primary_industry', None)
        for field, value in changes.items():
            if field in UPDATABLE_COMPANY_FIELDS:
                setattr(company, field, value)
        company.save()
        if industry_ids:
            industries = list(Industry.objects.filter(id__in=industry_ids))
            primary = next(
                (industry for industry in industries if industry.id == primary_id),
                industries[0] if industries else None,
            )
            set_company_industries(company, industries, primary)

    update_request.status = (
        update_request.Status.APPROVED
        if approve
        else update_request.Status.REJECTED
    )
    update_request.reviewed_by = admin_user
    update_request.reviewed_at = timezone.now()
    update_request.review_note = note
    update_request.save(update_fields=[
        'status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at',
    ])
    return update_request


@transaction.atomic
def verify_company(company, admin_user, approve, reason=''):
    """Review company verification after its documents were inspected."""
    if approve:
        company.verification_status = Company.VerificationStatus.VERIFIED
        company.verified_at = timezone.now()
        company.rejected_reason = ''
    else:
        company.verification_status = Company.VerificationStatus.REJECTED
        company.rejected_reason = reason
    company.save(update_fields=[
        'verification_status', 'verified_at', 'rejected_reason', 'updated_at',
    ])
    return company

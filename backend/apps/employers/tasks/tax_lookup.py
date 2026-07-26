"""Background VietQR lookup for employer verification evidence."""

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from ..models import CompanyTaxLookupEvidence
from ..services.tax_lookup import (
    TaxLookupRateLimited,
    TaxLookupUnavailable,
    lookup_company_tax,
)


def _finish_unavailable(evidence_id, description):
    CompanyTaxLookupEvidence.objects.filter(
        pk=evidence_id,
        status=CompanyTaxLookupEvidence.Status.PENDING,
    ).update(
        status=CompanyTaxLookupEvidence.Status.UNAVAILABLE,
        provider_description=str(description)[:500],
        completed_at=timezone.now(),
        updated_at=timezone.now(),
    )


@shared_task(bind=True, max_retries=2)
def lookup_company_tax_evidence(self, evidence_id):
    with transaction.atomic():
        evidence = CompanyTaxLookupEvidence.objects.select_for_update().get(pk=evidence_id)
        if evidence.status != CompanyTaxLookupEvidence.Status.PENDING:
            return evidence.public_id
        if evidence.started_at is None:
            evidence.started_at = timezone.now()
            evidence.save(update_fields=['started_at', 'updated_at'])
        tax_code = evidence.tax_code

    try:
        result = lookup_company_tax(tax_code)
    except TaxLookupRateLimited as error:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=error, countdown=error.retry_after) from error
        _finish_unavailable(evidence_id, 'VietQR đang giới hạn tần suất tra cứu.')
        return evidence.public_id
    except TaxLookupUnavailable as error:
        if self.request.retries < self.max_retries:
            raise self.retry(
                exc=error, countdown=min(2 ** (self.request.retries + 1), 60)
            ) from error
        _finish_unavailable(evidence_id, 'Không thể kết nối VietQR.')
        return evidence.public_id

    CompanyTaxLookupEvidence.objects.filter(
        pk=evidence_id,
        status=CompanyTaxLookupEvidence.Status.PENDING,
    ).update(
        **result.as_dict(),
        completed_at=timezone.now(),
        updated_at=timezone.now(),
    )
    return evidence.public_id

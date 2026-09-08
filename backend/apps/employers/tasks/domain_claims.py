from celery import shared_task
from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from common.metrics import record_metric

from ..models import CompanyDomainClaim, CompanyDomainClaimEvent
from ..services import reconcile_domain_claim


@shared_task
def reconcile_company_domain_claims():
    """Recheck due DNS proofs and expire time-bounded claims in batches."""

    now = timezone.now()
    batch_size = max(1, settings.EMPLOYER_DOMAIN_RECHECK_BATCH_SIZE)
    due_ids = list(
        CompanyDomainClaim.objects.filter(
            Q(
                method=CompanyDomainClaim.Method.DNS_TXT,
                status__in=[
                    CompanyDomainClaim.Status.VERIFIED,
                    CompanyDomainClaim.Status.GRACE,
                ],
                next_check_at__lte=now,
            )
            | Q(
                method=CompanyDomainClaim.Method.ADMIN_MANUAL,
                status=CompanyDomainClaim.Status.VERIFIED,
                expires_at__lte=now,
            )
        )
        .order_by('next_check_at', 'expires_at', 'id')
        .values_list('id', flat=True)[:batch_size]
    )
    processed = 0
    failures = 0
    for claim_id in due_ids:
        claim = CompanyDomainClaim.objects.filter(pk=claim_id).first()
        if claim is None:
            continue
        try:
            reconcile_domain_claim(claim, now=now)
        except Exception:  # noqa: BLE001 - next periodic batch retries safely
            failures += 1
        else:
            processed += 1

    expired_challenges = list(
        CompanyDomainClaim.objects.filter(
            status=CompanyDomainClaim.Status.PENDING,
            method=CompanyDomainClaim.Method.DNS_TXT,
            challenge_expires_at__lte=now,
        )
        .order_by('challenge_expires_at', 'id')
        .values_list('id', flat=True)[:batch_size]
    )
    for claim_id in expired_challenges:
        claim = CompanyDomainClaim.objects.filter(pk=claim_id).first()
        if claim is None:
            continue
        updated = CompanyDomainClaim.objects.filter(
            pk=claim.pk,
            status=CompanyDomainClaim.Status.PENDING,
            challenge_expires_at__lte=now,
        ).update(
            status=CompanyDomainClaim.Status.EXPIRED,
            lock_version=claim.lock_version + 1,
            updated_at=now,
        )
        if updated:
            CompanyDomainClaimEvent.objects.create(
                claim=claim,
                event_type=CompanyDomainClaimEvent.EventType.EXPIRED,
            )
            processed += 1
    record_metric(
        'employer_domain_claim_reconciliation',
        value=processed,
        status='partial_failure' if failures else 'ok',
    )
    return {'processed': processed, 'failures': failures}

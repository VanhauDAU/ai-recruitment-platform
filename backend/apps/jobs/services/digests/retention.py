"""Bounded retention of terminal digest history and send receipts."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from common.metrics import record_metric

from ...models import CandidateJobDigest, CandidateJobEmailReceipt

DIGEST_HISTORY_RETENTION = timedelta(days=90)


@transaction.atomic
def purge_candidate_job_digest_history(now=None):
    """Delete terminal outbox history and successful receipts after 90 days."""
    cutoff = (now or timezone.now()) - DIGEST_HISTORY_RETENTION
    receipt_count, _ = CandidateJobEmailReceipt.objects.filter(sent_at__lt=cutoff).delete()
    expired_digests = CandidateJobDigest.objects.filter(created_at__lt=cutoff).exclude(
        status__in=(
            CandidateJobDigest.Status.PENDING,
            CandidateJobDigest.Status.SENDING,
        )
    )
    digest_count = expired_digests.count()
    expired_digests.delete()
    record_metric(
        'candidate_job_digest',
        value=digest_count,
        event='retention',
        status='digests_purged',
    )
    record_metric(
        'candidate_job_digest',
        value=receipt_count,
        event='retention',
        status='receipts_purged',
    )
    return {'digests': digest_count, 'receipts': receipt_count}

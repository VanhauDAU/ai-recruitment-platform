"""Bounded retention of terminal digest history and send receipts."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.sitecontent.selectors import retention_days
from common.metrics import record_metric

from ...models import CandidateJobDigest, CandidateJobEmailReceipt

# Mức giữ lâu nhất; admin chỉ rút ngắn được (SiteSetting digest_history_retention_days).
DIGEST_HISTORY_RETENTION_DAYS = 90


@transaction.atomic
def purge_candidate_job_digest_history(now=None):
    """Delete terminal outbox history and successful receipts after the retention window."""
    days = retention_days('digest_history_retention_days', DIGEST_HISTORY_RETENTION_DAYS, minimum=7)
    cutoff = (now or timezone.now()) - timedelta(days=days)
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

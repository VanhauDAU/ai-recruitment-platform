"""Candidate-owned Job Alert eligibility for commercial dispatches.

The commercial layer never receives preference or CV data. It asks this
service for candidates whose existing, explicit Job Alert already matches the
job being promoted.
"""

from apps.accounts.services import is_account_accessible

from ..models import JobAlert
from ..models.alert_queries import strict_job_alert_matches


def _candidate_allows_configured_alerts(candidate):
    if not (
        candidate.is_candidate and candidate.email_verified and is_account_accessible(candidate)
    ):
        return False
    settings = getattr(
        getattr(candidate, 'candidate_profile', None),
        'email_notification_settings',
        None,
    )
    return settings is None or settings.configured_job_alerts


def matching_job_alert_recipient_page(*, job, after_alert_id=0, limit=200):
    """Return bounded recipient candidates backed by an active saved Job Alert."""
    alerts = (
        JobAlert.objects.filter(pk__gt=after_alert_id, is_active=True)
        .select_related(
            'candidate',
            'candidate__candidate_profile__email_notification_settings',
        )
        .prefetch_related('categories')
        .order_by('pk')[:limit]
    )
    alert_rows = list(alerts)
    recipients = {}
    for alert in alert_rows:
        candidate = alert.candidate
        if not _candidate_allows_configured_alerts(candidate):
            continue
        if strict_job_alert_matches(
            alert,
            published_before=job.published_at,
            job_ids=[job.pk],
            limit=1,
            ignore_cursor=True,
        ).exists():
            recipients.setdefault(
                candidate.pk,
                {
                    'candidate_id': candidate.pk,
                    'recipient_email': candidate.email,
                    'recipient_auth_revision': candidate.auth_revision,
                    'matched_alert_public_ids': [],
                },
            )['matched_alert_public_ids'].append(alert.public_id)
    next_cursor = alert_rows[-1].pk if alert_rows else after_alert_id
    return {
        'recipients': list(recipients.values()),
        'next_cursor': next_cursor,
        'finished': len(alert_rows) < limit,
    }


def candidate_still_allows_promoted_job_alert(*, candidate, job, alert_public_ids):
    """Revalidate identity, opt-out and saved-alert match immediately before SMTP."""
    if not _candidate_allows_configured_alerts(candidate):
        return False
    alerts = (
        JobAlert.objects.filter(
            candidate=candidate,
            public_id__in=alert_public_ids,
            is_active=True,
        )
        .prefetch_related('categories')
        .order_by('pk')
    )
    return any(
        strict_job_alert_matches(
            alert,
            published_before=job.published_at,
            job_ids=[job.pk],
            limit=1,
            ignore_cursor=True,
        ).exists()
        for alert in alerts
    )

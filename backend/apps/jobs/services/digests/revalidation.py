"""Send-time revalidation: which prepared items may still be emailed."""

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.services import is_account_accessible

from ...models import CandidateJobEmailSuppression, JobAlert
from ...models.alert_queries import followed_company_job_matches, strict_job_alert_matches
from ...models.querysets import active_jobs_queryset
from .eligibility import (
    candidate_email_settings,
    site_email_enabled,
    suitable_prerequisites_allowed,
)


def delivery_gate(digest):
    candidate = get_user_model().objects.filter(pk=digest.candidate_id).first()
    if not (
        candidate
        and is_account_accessible(candidate)
        and candidate.is_candidate
        and candidate.email_verified
        and candidate.email == digest.recipient_email
        and candidate.auth_revision == digest.recipient_auth_revision
        and site_email_enabled()
    ):
        return candidate, {}, False, False

    settings_state = candidate_email_settings(candidate)
    allowed_alert_fingerprints = {}
    if settings_state['configured']:
        allowed_alert_fingerprints = dict(
            JobAlert.objects.filter(
                candidate=candidate,
                public_id__in=digest.source_alert_public_ids,
                is_active=True,
            ).values_list('public_id', 'criteria_fingerprint')
        )
    suitable_allowed = bool(
        digest.includes_suitable_recommendations
        and settings_state['suitable']
        and suitable_prerequisites_allowed(candidate)
    )
    followed_allowed = bool(digest.includes_followed_companies and settings_state['followed'])
    return candidate, allowed_alert_fingerprints, suitable_allowed, followed_allowed


def _has_eligible_source(item):
    return bool(
        item._eligible_source_alert_public_ids
        or item._eligible_suitable_recommendation
        or item._eligible_followed_company
    )


def eligible_digest_items(
    digest,
    candidate,
    allowed_alert_fingerprints,
    suitable_allowed,
    followed_allowed,
):
    items = list(digest.items.select_related('job', 'source_alert').order_by('sort_order'))
    source_eligible = []
    for item in items:
        item._eligible_source_alert_public_ids = [
            public_id
            for public_id in item.source_alert_public_ids
            if item.source_alert_fingerprints.get(public_id)
            == allowed_alert_fingerprints.get(public_id)
        ]
        item._eligible_suitable_recommendation = bool(
            item.includes_suitable_recommendation and suitable_allowed
        )
        item._eligible_followed_company = bool(item.includes_followed_company and followed_allowed)
        if _has_eligible_source(item):
            source_eligible.append(item)
    if not source_eligible:
        return []

    job_ids = [item.job_id for item in source_eligible]
    referenced_alert_public_ids = {
        public_id
        for item in source_eligible
        for public_id in item._eligible_source_alert_public_ids
    }
    matching_job_ids_by_alert = {}
    current_alerts = (
        JobAlert.objects.filter(
            candidate=candidate,
            public_id__in=referenced_alert_public_ids,
            is_active=True,
        )
        .select_related('candidate')
        .prefetch_related('categories')
        .order_by('pk')
    )
    validation_cutoff = timezone.now()
    for alert in current_alerts:
        matching_job_ids_by_alert[alert.public_id] = {
            job.pk
            for job in strict_job_alert_matches(
                alert,
                published_before=validation_cutoff,
                limit=len(job_ids),
                job_ids=job_ids,
                exclude_digest_id=digest.pk,
            )
        }

    # A follow removed, muted or put on hold after preparation closes the source.
    still_followed_job_ids = (
        set(
            followed_company_job_matches(
                candidate,
                published_before=validation_cutoff,
                limit=None,
                job_ids=job_ids,
                exclude_digest_id=digest.pk,
            ).values_list('pk', flat=True)
        )
        if any(item._eligible_followed_company for item in source_eligible)
        else set()
    )

    for item in source_eligible:
        item._eligible_source_alert_public_ids = [
            public_id
            for public_id in item._eligible_source_alert_public_ids
            if item.job_id in matching_job_ids_by_alert.get(public_id, set())
        ]
        item._eligible_followed_company = bool(
            item._eligible_followed_company and item.job_id in still_followed_job_ids
        )
    source_eligible = [item for item in source_eligible if _has_eligible_source(item)]
    if not source_eligible:
        return []

    job_ids = [item.job_id for item in source_eligible]
    current_jobs = {
        job.pk: job
        for job in (
            active_jobs_queryset()
            .filter(pk__in=job_ids)
            .exclude(applications__candidate=candidate)
            .exclude(saved_by__candidate=candidate)
            .distinct()
        )
    }
    already_suppressed = set(
        CandidateJobEmailSuppression.objects.filter(
            candidate=candidate,
            job_id__in=job_ids,
        ).values_list('job_id', flat=True)
    )
    eligible = []
    for item in source_eligible:
        job = current_jobs.get(item.job_id)
        if (
            job is None
            or job.published_at != item.job_published_at
            or item.job_id in already_suppressed
        ):
            continue
        item.job = job
        eligible.append(item)
    return eligible

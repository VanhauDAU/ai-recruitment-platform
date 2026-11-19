"""Due-source discovery: schedule backstops, claim leases and their release."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.candidates.models import CandidateConsent, CandidateEmailNotificationSettings
from apps.employers.models import CompanyFollow

from ...models import (
    CandidateFollowedCompanyDigestSchedule,
    CandidateJobDigestSchedule,
    JobAlert,
)
from ..alerts import next_job_alert_run
from .eligibility import site_email_enabled

MAX_DUE_CANDIDATES = 100
PREPARATION_CLAIM_LEASE = timedelta(minutes=15)


def initialize_missing_suitable_digest_schedules(now=None):
    """Backstop the on-commit opt-in hook without treating historical defaults as opt-in."""
    now = now or timezone.now()
    missing_ids = list(
        CandidateEmailNotificationSettings.objects.filter(
            suitable_job_recommendations=True,
            candidate_profile__user__role='candidate',
            candidate_profile__user__is_active=True,
            candidate_profile__user__is_deleted=False,
            candidate_profile__user__status='active',
            candidate_profile__user__email_verified=True,
            candidate_profile__job_preferences_configured=True,
            candidate_profile__job_preference__isnull=False,
            candidate_profile__consents__consent_type=(
                CandidateConsent.ConsentType.AI_RECOMMENDATION
            ),
            candidate_profile__consents__decision=CandidateConsent.Decision.GRANTED,
            candidate_profile__user__job_digest_schedule__isnull=True,
        )
        .order_by('candidate_profile__user_id')
        .values_list('candidate_profile__user_id', flat=True)[:MAX_DUE_CANDIDATES]
    )
    CandidateJobDigestSchedule.objects.bulk_create(
        [
            CandidateJobDigestSchedule(
                candidate_id=candidate_id,
                suitable_cursor_at=now,
                suitable_next_run_at=next_job_alert_run(now, JobAlert.Frequency.WEEKLY),
            )
            for candidate_id in missing_ids
        ],
        ignore_conflicts=True,
    )
    return len(missing_ids)


def remove_ineligible_suitable_digest_schedules():
    """Boundedly remove disabled schedules so a later opt-in starts from then."""
    eligible_candidates = get_user_model().objects.filter(
        role='candidate',
        is_active=True,
        is_deleted=False,
        status='active',
        email_verified=True,
        candidate_profile__job_preferences_configured=True,
        candidate_profile__job_preference__isnull=False,
        candidate_profile__email_notification_settings__suitable_job_recommendations=True,
        candidate_profile__consents__consent_type=(CandidateConsent.ConsentType.AI_RECOMMENDATION),
        candidate_profile__consents__decision=CandidateConsent.Decision.GRANTED,
    )
    schedule_ids = list(
        CandidateJobDigestSchedule.objects.exclude(
            candidate_id__in=models.Subquery(eligible_candidates.values('pk'))
        )
        .order_by('pk')
        .values_list('pk', flat=True)[:MAX_DUE_CANDIDATES]
    )
    deleted, _ = CandidateJobDigestSchedule.objects.filter(pk__in=schedule_ids).delete()
    return deleted


def initialize_missing_followed_company_digest_schedules(now=None):
    """Give candidates with a notifying follow a daily schedule, bounded per tick.

    The follow service lives in another app, so this scheduler backstop is the
    only writer. The cursor starts at the earliest follow: each follow's own
    ``created_at`` is what keeps a company's older jobs out of the email.
    """
    now = now or timezone.now()
    missing = list(
        CompanyFollow.objects.filter(
            notify_new_jobs=True,
            candidate__role='candidate',
            candidate__is_active=True,
            candidate__is_deleted=False,
            candidate__status='active',
            candidate__email_verified=True,
            candidate__followed_company_digest_schedule__isnull=True,
        )
        .values('candidate_id')
        .annotate(first_followed_at=models.Min('created_at'))
        .order_by('candidate_id')[:MAX_DUE_CANDIDATES]
    )
    CandidateFollowedCompanyDigestSchedule.objects.bulk_create(
        [
            CandidateFollowedCompanyDigestSchedule(
                candidate_id=row['candidate_id'],
                cursor_at=row['first_followed_at'],
                next_run_at=next_job_alert_run(now, JobAlert.Frequency.DAILY),
            )
            for row in missing
        ],
        ignore_conflicts=True,
    )
    return len(missing)


def _followed_due_exists(now):
    return models.Exists(
        CandidateFollowedCompanyDigestSchedule.objects.filter(
            candidate_id=models.OuterRef('pk'),
            next_run_at__lte=now,
        )
    )


def _due_candidate_queryset(now):
    notification_settings = CandidateEmailNotificationSettings.objects.filter(
        candidate_profile__user_id=models.OuterRef('pk')
    )
    suitable_allowed = notification_settings.filter(
        suitable_job_recommendations=True,
        candidate_profile__job_preferences_configured=True,
        candidate_profile__job_preference__isnull=False,
        candidate_profile__consents__consent_type=(CandidateConsent.ConsentType.AI_RECOMMENDATION),
        candidate_profile__consents__decision=CandidateConsent.Decision.GRANTED,
    )
    return (
        get_user_model()
        .objects.filter(
            role='candidate',
            is_active=True,
            is_deleted=False,
            status='active',
            email_verified=True,
        )
        .annotate(
            _configured_due=models.Exists(
                JobAlert.objects.filter(
                    candidate_id=models.OuterRef('pk'),
                    is_active=True,
                    next_run_at__lte=now,
                )
            ),
            _configured_opted_out=models.Exists(
                notification_settings.filter(configured_job_alerts=False)
            ),
            _suitable_due=models.Exists(
                CandidateJobDigestSchedule.objects.filter(
                    candidate_id=models.OuterRef('pk'),
                    suitable_next_run_at__lte=now,
                )
            ),
            _suitable_allowed=models.Exists(suitable_allowed),
            _followed_due=_followed_due_exists(now),
            _followed_opted_out=models.Exists(
                notification_settings.filter(followed_company_jobs=False)
            ),
            _followed_active=models.Exists(
                CompanyFollow.objects.filter(
                    candidate_id=models.OuterRef('pk'),
                    notify_new_jobs=True,
                    company__content_policy_hold=False,
                )
            ),
        )
        .filter(
            models.Q(_configured_due=True, _configured_opted_out=False)
            | models.Q(_suitable_due=True, _suitable_allowed=True)
            | models.Q(_followed_due=True, _followed_opted_out=False, _followed_active=True)
        )
        .order_by('pk')
    )


def due_candidate_ids(now=None):
    now = now or timezone.now()
    return list(_due_candidate_queryset(now).values_list('pk', flat=True)[:MAX_DUE_CANDIDATES])


def _advance_sources_without_delivery(candidate_ids, now):
    alerts = list(
        JobAlert.objects.select_for_update()
        .filter(candidate_id__in=candidate_ids, is_active=True, next_run_at__lte=now)
        .order_by('pk')
    )
    for alert in alerts:
        alert.cursor_at = now
        alert.next_run_at = next_job_alert_run(now, alert.frequency)
        alert.updated_at = now
    JobAlert.objects.bulk_update(alerts, ['cursor_at', 'next_run_at', 'updated_at'])

    schedules = list(
        CandidateJobDigestSchedule.objects.select_for_update()
        .filter(candidate_id__in=candidate_ids, suitable_next_run_at__lte=now)
        .order_by('pk')
    )
    for schedule in schedules:
        schedule.suitable_cursor_at = now
        schedule.suitable_next_run_at = next_job_alert_run(now, JobAlert.Frequency.WEEKLY)
        schedule.updated_at = now
    CandidateJobDigestSchedule.objects.bulk_update(
        schedules,
        ['suitable_cursor_at', 'suitable_next_run_at', 'updated_at'],
    )

    followed_schedules = list(
        CandidateFollowedCompanyDigestSchedule.objects.select_for_update()
        .filter(candidate_id__in=candidate_ids, next_run_at__lte=now)
        .order_by('pk')
    )
    for followed_schedule in followed_schedules:
        followed_schedule.cursor_at = now
        followed_schedule.next_run_at = next_job_alert_run(now, JobAlert.Frequency.DAILY)
        followed_schedule.updated_at = now
    CandidateFollowedCompanyDigestSchedule.objects.bulk_update(
        followed_schedules,
        ['cursor_at', 'next_run_at', 'updated_at'],
    )


@transaction.atomic
def claim_due_candidate_job_digest_candidates(now=None):
    """Lease one bounded preparation page so later candidate IDs can progress."""
    now = now or timezone.now()
    remove_ineligible_suitable_digest_schedules()
    initialize_missing_suitable_digest_schedules(now)
    initialize_missing_followed_company_digest_schedules(now)

    if not site_email_enabled():
        candidate_ids = list(
            get_user_model()
            .objects.select_for_update()
            .annotate(
                _configured_due=models.Exists(
                    JobAlert.objects.filter(
                        candidate_id=models.OuterRef('pk'),
                        is_active=True,
                        next_run_at__lte=now,
                    )
                ),
                _suitable_due=models.Exists(
                    CandidateJobDigestSchedule.objects.filter(
                        candidate_id=models.OuterRef('pk'),
                        suitable_next_run_at__lte=now,
                    )
                ),
                _followed_due=_followed_due_exists(now),
            )
            .filter(
                models.Q(_configured_due=True)
                | models.Q(_suitable_due=True)
                | models.Q(_followed_due=True)
            )
            .order_by('pk')
            .values_list('pk', flat=True)[:MAX_DUE_CANDIDATES]
        )
        _advance_sources_without_delivery(candidate_ids, now)
        return []

    candidate_ids = list(
        _due_candidate_queryset(now)
        .select_for_update()
        .values_list('pk', flat=True)[:MAX_DUE_CANDIDATES]
    )
    if not candidate_ids:
        return []

    configured_opted_out = set(
        CandidateEmailNotificationSettings.objects.filter(
            candidate_profile__user_id__in=candidate_ids,
            configured_job_alerts=False,
        ).values_list('candidate_profile__user_id', flat=True)
    )
    alerts = list(
        JobAlert.objects.select_for_update()
        .filter(
            candidate_id__in=set(candidate_ids) - configured_opted_out,
            is_active=True,
            next_run_at__lte=now,
        )
        .order_by('pk')
    )
    suitable_candidate_ids = set(
        CandidateEmailNotificationSettings.objects.filter(
            candidate_profile__user_id__in=candidate_ids,
            suitable_job_recommendations=True,
            candidate_profile__job_preferences_configured=True,
            candidate_profile__job_preference__isnull=False,
            candidate_profile__consents__consent_type=(
                CandidateConsent.ConsentType.AI_RECOMMENDATION
            ),
            candidate_profile__consents__decision=CandidateConsent.Decision.GRANTED,
        ).values_list('candidate_profile__user_id', flat=True)
    )
    schedules = list(
        CandidateJobDigestSchedule.objects.select_for_update()
        .filter(
            candidate_id__in=suitable_candidate_ids,
            suitable_next_run_at__lte=now,
        )
        .order_by('pk')
    )
    followed_candidate_ids = set(candidate_ids) - set(
        CandidateEmailNotificationSettings.objects.filter(
            candidate_profile__user_id__in=candidate_ids,
            followed_company_jobs=False,
        ).values_list('candidate_profile__user_id', flat=True)
    )
    followed_schedules = list(
        CandidateFollowedCompanyDigestSchedule.objects.select_for_update()
        .filter(candidate_id__in=followed_candidate_ids, next_run_at__lte=now)
        .order_by('pk')
    )
    lease_until = now + PREPARATION_CLAIM_LEASE
    claimed_candidate_ids = set()
    for alert in alerts:
        alert.next_run_at = lease_until
        alert.updated_at = now
        claimed_candidate_ids.add(alert.candidate_id)
    JobAlert.objects.bulk_update(alerts, ['next_run_at', 'updated_at'])
    for schedule in schedules:
        schedule.suitable_next_run_at = lease_until
        schedule.updated_at = now
        claimed_candidate_ids.add(schedule.candidate_id)
    CandidateJobDigestSchedule.objects.bulk_update(
        schedules,
        ['suitable_next_run_at', 'updated_at'],
    )
    for followed_schedule in followed_schedules:
        followed_schedule.next_run_at = lease_until
        followed_schedule.updated_at = now
        claimed_candidate_ids.add(followed_schedule.candidate_id)
    CandidateFollowedCompanyDigestSchedule.objects.bulk_update(
        followed_schedules,
        ['next_run_at', 'updated_at'],
    )
    return [
        {'candidate_id': candidate_id, 'claimed_at': now.isoformat()}
        for candidate_id in candidate_ids
        if candidate_id in claimed_candidate_ids
    ]


@transaction.atomic
def release_candidate_job_digest_claim(candidate_id, claimed_at):
    """Make a lease immediately due again when broker publication fails."""
    claimed_at = parse_datetime(claimed_at) if isinstance(claimed_at, str) else claimed_at
    if claimed_at is None:
        return
    lease_until = claimed_at + PREPARATION_CLAIM_LEASE
    JobAlert.objects.filter(
        candidate_id=candidate_id,
        updated_at=claimed_at,
        next_run_at=lease_until,
    ).update(next_run_at=claimed_at)
    CandidateJobDigestSchedule.objects.filter(
        candidate_id=candidate_id,
        updated_at=claimed_at,
        suitable_next_run_at=lease_until,
    ).update(suitable_next_run_at=claimed_at)
    CandidateFollowedCompanyDigestSchedule.objects.filter(
        candidate_id=candidate_id,
        updated_at=claimed_at,
        next_run_at=lease_until,
    ).update(next_run_at=claimed_at)

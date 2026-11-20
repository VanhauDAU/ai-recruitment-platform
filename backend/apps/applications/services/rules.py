"""The application rules the clients display, read from the policy the services enforce."""

from apps.jobs.models import Job
from apps.jobs.services import auto_reject_default_days

from .policy import (
    auto_rejection_email_grace,
    auto_rejection_min_notice,
    candidate_reminder_policy,
    max_applications_per_job,
    reapply_cooldown,
)


def application_rules():
    reminders = candidate_reminder_policy()
    return {
        'max_submissions_per_job': max_applications_per_job(),
        'reapply_cooldown_seconds': int(reapply_cooldown().total_seconds()),
        'candidate_reminder_after_days': reminders.after.days,
        'candidate_reminder_interval_days': reminders.interval.days,
        'max_candidate_reminders': reminders.max_count,
        'auto_reject_default_days': auto_reject_default_days(),
        'auto_reject_after_day_choices': [
            {'value': days, 'label': label} for days, label in Job.AUTO_REJECTION_AFTER_DAY_CHOICES
        ],
        'auto_rejection_warning_days': auto_rejection_min_notice().days,
        'auto_rejection_email_grace_days': auto_rejection_email_grace().days,
    }

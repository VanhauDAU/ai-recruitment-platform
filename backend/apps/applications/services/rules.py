"""The application rules the clients display, read from the services that enforce them."""

from apps.jobs.models import Job

from .applications import MAX_APPLICATIONS_PER_JOB, REAPPLICATION_COOLDOWN
from .automatic_rejection import REMINDER_LEAD_TIME
from .reminders import (
    CANDIDATE_REMINDER_AFTER,
    CANDIDATE_REMINDER_INTERVAL,
    MAX_CANDIDATE_REMINDERS,
)
from .status import AUTO_REJECTION_EMAIL_GRACE


def application_rules():
    return {
        'max_submissions_per_job': MAX_APPLICATIONS_PER_JOB,
        'reapply_cooldown_seconds': int(REAPPLICATION_COOLDOWN.total_seconds()),
        'candidate_reminder_after_days': CANDIDATE_REMINDER_AFTER.days,
        'candidate_reminder_interval_days': CANDIDATE_REMINDER_INTERVAL.days,
        'max_candidate_reminders': MAX_CANDIDATE_REMINDERS,
        'auto_reject_after_day_choices': [
            {'value': days, 'label': label} for days, label in Job.AUTO_REJECTION_AFTER_DAY_CHOICES
        ],
        'auto_rejection_warning_days': REMINDER_LEAD_TIME.days,
        'auto_rejection_email_grace_days': AUTO_REJECTION_EMAIL_GRACE.days,
    }

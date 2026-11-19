from datetime import timedelta

from django.conf import settings
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

MAX_VISIBILITY_DAYS = 90


def job_lifecycle_policy():
    maximum_days = min(MAX_VISIBILITY_DAYS, max(1, settings.JOB_POSTING_MAX_PUBLIC_LIFETIME_DAYS))
    default_days = min(max(1, settings.JOB_POSTING_DEFAULT_DEADLINE_DAYS), maximum_days)
    return {
        'default_visibility_days': default_days,
        'max_visibility_days': maximum_days,
        'timezone': 'Asia/Ho_Chi_Minh',
    }


def visibility_days_error(value):
    policy = job_lifecycle_policy()
    if value is None:
        return _('Chọn thời gian hiển thị tin.')
    if not 1 <= value <= policy['max_visibility_days']:
        return _('Thời gian hiển thị phải từ 1 đến %(days)s ngày.') % {
            'days': policy['max_visibility_days']
        }
    return ''


def initialize_job_visibility(job, *, approved_at):
    """Initialize one public-cycle anchor without resetting an existing cycle."""
    if error := visibility_days_error(job.requested_visibility_days):
        raise ValidationError({'requested_visibility_days': error})

    changed_fields = []
    if job.first_approved_at is None:
        job.first_approved_at = approved_at
        changed_fields.append('first_approved_at')
    if job.visibility_starts_at is None:
        job.visibility_starts_at = job.first_approved_at
        changed_fields.append('visibility_starts_at')
    if job.visibility_ends_at is None:
        job.visibility_ends_at = job.visibility_starts_at + timedelta(
            days=job.requested_visibility_days
        )
        changed_fields.append('visibility_ends_at')
    return changed_fields


def extend_job_visibility(job, *, requested_visibility_days):
    """Extend the current public cycle without moving its immutable anchor."""
    if error := visibility_days_error(requested_visibility_days):
        raise ValidationError({'requested_visibility_days': error})
    if requested_visibility_days <= job.requested_visibility_days:
        raise ValidationError(
            {'requested_visibility_days': _('Thời gian hiển thị mới phải dài hơn hiện tại.')}
        )

    job.requested_visibility_days = requested_visibility_days
    changed_fields = ['requested_visibility_days']
    if job.visibility_starts_at is not None:
        job.visibility_ends_at = job.visibility_starts_at + timedelta(
            days=requested_visibility_days
        )
        changed_fields.append('visibility_ends_at')
    return changed_fields

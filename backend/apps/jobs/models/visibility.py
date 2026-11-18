"""Giving a job back the display time a platform hold took from it."""

from datetime import datetime

from django.db.models import DateTimeField as _DateTimeField
from django.db.models import DurationField, ExpressionWrapper, F, Value

from .core import Job


def give_back_hidden_time(jobs, *, since, now):
    """Extend each active job's display window by the time it spent hidden.

    ``since`` is when the hold started: a datetime, or an expression such as
    ``F('policy_held_at')`` for a per-job start. Only the window still left at
    that moment is restored; the application deadline is never moved. Holds
    the employer clears alone (deadline, DPA, readiness) are not given back.
    """
    if since is None:
        return 0
    start = since if not isinstance(since, datetime) else Value(since, _DateTimeField())
    gap = ExpressionWrapper(Value(now, _DateTimeField()) - start, output_field=DurationField())
    return jobs.filter(
        status=Job.Status.ACTIVE,
        visibility_ends_at__isnull=False,
        visibility_ends_at__gt=start,
    ).update(visibility_ends_at=F('visibility_ends_at') + gap)

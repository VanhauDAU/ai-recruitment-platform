"""Shared builders for job tests."""

from datetime import timedelta

from django.utils import timezone


def open_visibility_window(*, days=30):
    """Visibility window of a job that went live yesterday, as publishing sets it."""
    now = timezone.now()
    return {
        'visibility_starts_at': now - timedelta(days=1),
        'visibility_ends_at': now + timedelta(days=days),
    }

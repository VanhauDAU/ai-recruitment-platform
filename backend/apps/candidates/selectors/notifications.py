"""Read queries for the candidate notification inbox."""

from ..models import CandidateNotification


def candidate_notification_queryset(user):
    """Only released notices on the website channel; scheduled, withdrawn or
    web-disabled ones stay invisible."""
    return CandidateNotification.objects.filter(
        recipient=user, delivered_at__isnull=False, show_in_inbox=True
    ).order_by('-delivered_at', '-id')


def candidate_unread_notification_count(user):
    return CandidateNotification.objects.filter(
        recipient=user, delivered_at__isnull=False, show_in_inbox=True, read_at__isnull=True
    ).count()

"""Daily health snapshots read back for the trend chart."""

from ..models import CampaignHealthSnapshot

HISTORY_DAYS = 60


def campaign_health_history(campaign, *, days=HISTORY_DAYS):
    """The latest ``days`` snapshots, oldest first."""
    snapshots = CampaignHealthSnapshot.objects.filter(campaign=campaign).order_by('-date')[:days]
    return [
        {
            'date': snapshot.date,
            'status': snapshot.status,
            'forecast': snapshot.metrics.get('forecast'),
            'accepted': snapshot.metrics.get('accepted'),
            'applications': snapshot.metrics.get('applications'),
            'headcount': snapshot.metrics.get('headcount'),
        }
        for snapshot in reversed(snapshots)
    ]

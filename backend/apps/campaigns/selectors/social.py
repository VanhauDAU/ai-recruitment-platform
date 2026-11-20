"""Social connections and scheduled posts, scoped to the recruiter."""

from ..models import ScheduledSocialPost, SocialAccountConnection


def recruiter_social_connections_queryset(user):
    return SocialAccountConnection.objects.filter(owner__user=user)


def active_social_connections_queryset(user):
    """Connections the integrations page lists: everything not revoked."""
    return recruiter_social_connections_queryset(user).exclude(
        status=SocialAccountConnection.Status.REVOKED
    )


def channel_posts_queryset(channel):
    return ScheduledSocialPost.objects.filter(channel=channel).select_related(
        'channel__campaign__owner', 'connection'
    )

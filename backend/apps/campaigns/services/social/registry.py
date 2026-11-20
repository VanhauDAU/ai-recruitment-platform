"""Pick each network's provider: real when listed in ``CAMPAIGN_SOCIAL_LIVE_NETWORKS``."""

from django.conf import settings

from ...domain.social_networks import FACEBOOK_PAGE, INSTAGRAM, NETWORKS


def is_live(network):
    return network in settings.CAMPAIGN_SOCIAL_LIVE_NETWORKS


def oauth_redirect_uri(network):
    """Where the network sends the browser back after the consent screen."""
    if network == FACEBOOK_PAGE:
        return settings.FACEBOOK_OAUTH_REDIRECT_URI  # already registered with Meta
    return f'{settings.FRONTEND_URL.rstrip("/")}/api/employer/social/{network}/callback/'


def get_provider(network):
    if network not in NETWORKS:
        raise KeyError(network)
    if not is_live(network):
        from .fake import FakeProvider

        return FakeProvider(network)
    if network == INSTAGRAM:
        from .instagram import InstagramProvider

        return InstagramProvider()
    from .facebook import FacebookPageProvider

    return FacebookPageProvider()

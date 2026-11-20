"""Pick each network's provider: real when listed in ``CAMPAIGN_SOCIAL_LIVE_NETWORKS``."""

from django.conf import settings

from ...domain.social_networks import FACEBOOK_PAGE, INSTAGRAM, LINKEDIN, NETWORKS, THREADS


def is_live(network):
    return network in settings.CAMPAIGN_SOCIAL_LIVE_NETWORKS


# Settings that pin a network's redirect URI to the one registered with it.
# Threads and LinkedIn only accept HTTPS, so a local setup registers
# ``https://localhost...`` here while the app itself runs on HTTP.
REDIRECT_URI_SETTINGS = {
    FACEBOOK_PAGE: 'FACEBOOK_OAUTH_REDIRECT_URI',
    THREADS: 'THREADS_OAUTH_REDIRECT_URI',
    LINKEDIN: 'LINKEDIN_OAUTH_REDIRECT_URI',
}


def oauth_redirect_uri(network):
    """Where the network sends the browser back after the consent screen."""
    configured = getattr(settings, REDIRECT_URI_SETTINGS.get(network, ''), '')
    if configured:
        return configured
    return f'{settings.FRONTEND_URL.rstrip("/")}/api/employer/social/{network}/callback/'


def get_provider(network):
    if network not in NETWORKS:
        raise KeyError(network)
    if not is_live(network):
        from .fake import FakeProvider

        return FakeProvider(network)
    if network == LINKEDIN:
        from .linkedin import LinkedInProvider

        return LinkedInProvider()
    if network == THREADS:
        from .threads import ThreadsProvider

        return ThreadsProvider()
    if network == INSTAGRAM:
        from .instagram import InstagramProvider

        return InstagramProvider()
    from .facebook import FacebookPageProvider

    return FacebookPageProvider()

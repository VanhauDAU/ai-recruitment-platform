"""Social networks a campaign channel can post to automatically, and their limits.

One entry per network with a provider. Adding a network means one entry here,
one provider in ``services/social`` and the matching ``CampaignChannel.Kind``.
"""

from dataclasses import dataclass

from django.utils.translation import gettext_lazy


@dataclass(frozen=True)
class Capabilities:
    max_chars: int
    max_images: int
    requires_image: bool = False
    # False: the network's API cannot remove a post, so the recruiter removes it by hand.
    supports_delete: bool = True


@dataclass(frozen=True)
class SocialNetwork:
    key: str
    platform: str  # brand name used in error messages, e.g. "Facebook"
    label: object  # what the recruiter connects, e.g. "Fanpage Facebook"
    channel_kind: str
    capabilities: Capabilities


FACEBOOK_PAGE = 'facebook_page'

NETWORKS = {
    FACEBOOK_PAGE: SocialNetwork(
        key=FACEBOOK_PAGE,
        platform='Facebook',
        label=gettext_lazy('Fanpage Facebook'),
        channel_kind='facebook_page',
        capabilities=Capabilities(max_chars=5000, max_images=4),
    ),
}

NETWORK_CHOICES = [(network.key, network.label) for network in NETWORKS.values()]


def network_for_channel_kind(kind):
    """The network a channel of ``kind`` posts to automatically, or None."""
    return next((network for network in NETWORKS.values() if network.channel_kind == kind), None)

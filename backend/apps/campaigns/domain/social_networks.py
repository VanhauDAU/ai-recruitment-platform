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
    # (narrowest, widest) width/height the network accepts; images outside are
    # re-rendered as JPEG with white padding. None: images are sent as they are.
    image_ratio: tuple[float, float] | None = None


@dataclass(frozen=True)
class SocialNetwork:
    key: str
    platform: str  # brand name used in error messages, e.g. "Facebook"
    label: object  # what the recruiter connects, e.g. "Fanpage Facebook"
    channel_kind: str
    capabilities: Capabilities
    # Days an account token lasts; None: no expiry. Without ``token_refreshable``
    # the recruiter is reminded to reconnect before it lapses.
    token_days: int | None = None
    token_refreshable: bool = True


FACEBOOK_PAGE = 'facebook_page'
INSTAGRAM = 'instagram'
THREADS = 'threads'
LINKEDIN = 'linkedin'

NETWORKS = {
    FACEBOOK_PAGE: SocialNetwork(
        key=FACEBOOK_PAGE,
        platform='Facebook',
        label=gettext_lazy('Fanpage Facebook'),
        channel_kind='facebook_page',
        capabilities=Capabilities(max_chars=5000, max_images=4),
    ),
    # Instagram professional account linked to a Facebook Page, through Facebook
    # Login: Page token, carousel up to 20 images, JPEG from 4:5 to 1.91:1.
    INSTAGRAM: SocialNetwork(
        key=INSTAGRAM,
        platform='Instagram',
        label=gettext_lazy('Instagram doanh nghiệp'),
        channel_kind='instagram',
        capabilities=Capabilities(
            max_chars=2200, max_images=10, requires_image=True, image_ratio=(0.8, 1.91)
        ),
    ),
    # Threads profile through Threads Login: 60-day token refreshed daily, text up
    # to 500 characters, JPEG/PNG up to 10:1 (sent as JPEG), carousel up to 20.
    THREADS: SocialNetwork(
        key=THREADS,
        platform='Threads',
        label=gettext_lazy('Threads'),
        channel_kind='threads',
        capabilities=Capabilities(max_chars=500, max_images=10, image_ratio=(0.1, 10.0)),
        token_days=60,
    ),
    # LinkedIn member profile through "Share on LinkedIn" (w_member_social): 60-day
    # token that self-serve apps cannot refresh, posts up to 3000 characters,
    # 2-20 images per multi-image post (sent as JPEG).
    LINKEDIN: SocialNetwork(
        key=LINKEDIN,
        platform='LinkedIn',
        label=gettext_lazy('Trang cá nhân LinkedIn'),
        channel_kind='linkedin',
        capabilities=Capabilities(max_chars=3000, max_images=10, image_ratio=(0.1, 10.0)),
        token_days=60,
        token_refreshable=False,
    ),
}

NETWORK_CHOICES = [(network.key, network.label) for network in NETWORKS.values()]


def network_for_channel_kind(kind):
    """The network a channel of ``kind`` posts to automatically, or None."""
    return next((network for network in NETWORKS.values() if network.channel_kind == kind), None)

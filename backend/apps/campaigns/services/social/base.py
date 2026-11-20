"""Provider contract for posting campaign content to a social network.

A provider serves one network and exposes:

- ``network``: the key in ``domain.social_networks.NETWORKS``;
- ``simulated``: True for the in-process fake;
- ``authorize_url(state)`` and ``exchange_code(code)`` for OAuth;
- ``list_accounts(user_token)``: the accounts the user may post as;
- ``publish(account_id=, token=, message=, link=, images=)``, ``images`` being
  ``PostImage`` items (bytes for upload, public URL for networks that fetch);
- ``find_recent_post(account_id=, token=, link=)``: a post already carrying
  ``link``, so a retry after a timeout does not post twice;
- ``delete(post_id=, token=)``, only called when the network supports it.
"""

from dataclasses import dataclass


class SocialProviderError(Exception):
    """A provider failure with a log-safe code.

    ``transient`` errors are retried with backoff; ``token_invalid`` marks the
    connection expired so the recruiter reconnects.
    """

    def __init__(self, code, *, transient=False, token_invalid=False):
        super().__init__(code)
        self.code = code
        self.transient = transient
        self.token_invalid = token_invalid


@dataclass(frozen=True)
class SocialAccount:
    account_id: str
    name: str
    picture_url: str
    token: str


@dataclass(frozen=True)
class PublishedPost:
    post_id: str
    permalink: str


@dataclass(frozen=True)
class PostImage:
    name: str
    content: bytes
    url: str

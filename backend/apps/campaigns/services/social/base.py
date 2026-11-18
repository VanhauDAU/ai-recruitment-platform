"""Provider contract for posting campaign content to a social page."""

from dataclasses import dataclass


class SocialProviderError(Exception):
    """A provider failure with a log-safe code.

    ``transient`` errors are retried with backoff; ``token_invalid`` marks the
    page connection expired so the recruiter reconnects.
    """

    def __init__(self, code, *, transient=False, token_invalid=False):
        super().__init__(code)
        self.code = code
        self.transient = transient
        self.token_invalid = token_invalid


@dataclass(frozen=True)
class SocialPage:
    page_id: str
    name: str
    picture_url: str
    token: str


@dataclass(frozen=True)
class PublishedPost:
    post_id: str
    permalink: str

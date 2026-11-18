from django.conf import settings

from .base import PublishedPost, SocialPage, SocialProviderError
from .crypto import decrypt_token, encrypt_token


def get_provider():
    """The configured page provider: real Graph API or the in-process fake."""
    if settings.CAMPAIGN_SOCIAL_PROVIDER == 'facebook':
        from .facebook import FacebookPageProvider

        return FacebookPageProvider()
    from .fake import FakePageProvider

    return FakePageProvider()


__all__ = [
    'PublishedPost',
    'SocialPage',
    'SocialProviderError',
    'decrypt_token',
    'encrypt_token',
    'get_provider',
]

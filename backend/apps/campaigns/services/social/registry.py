"""Chọn provider đăng Fanpage theo ``CAMPAIGN_SOCIAL_PROVIDER``."""

from django.conf import settings


def get_provider():
    """The configured page provider: real Graph API or the in-process fake."""
    if settings.CAMPAIGN_SOCIAL_PROVIDER == 'facebook':
        from .facebook import FacebookPageProvider

        return FacebookPageProvider()
    from .fake import FakePageProvider

    return FakePageProvider()

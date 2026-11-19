"""Hằng số thuần của privacy: salt ký cookie đồng ý và mã người xem."""

from .signing import CONSENT_SIGNING_SALT, VIEWER_SIGNING_SALT

__all__ = [
    'CONSENT_SIGNING_SALT',
    'VIEWER_SIGNING_SALT',
]

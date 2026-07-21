"""Signed cookie helpers for the consent source of truth."""

from django.conf import settings
from django.core import signing

from ..constants import CONSENT_SIGNING_SALT

OPTIONAL_CATEGORIES = ('preferences', 'analytics', 'marketing')


def build_consent(*, preferences=False, analytics=False, marketing=False):
    """Return the minimal, normalized payload that may be stored in a cookie."""
    return {
        'version': settings.CONSENT_POLICY_VERSION,
        'necessary': True,
        'preferences': bool(preferences),
        'analytics': bool(analytics),
        'marketing': bool(marketing),
    }


def load_consent(request):
    """Read a valid current-policy consent cookie, otherwise fail closed."""
    value = request.COOKIES.get(settings.CONSENT_COOKIE_NAME)
    if not value:
        return None
    try:
        consent = signing.loads(value, salt=CONSENT_SIGNING_SALT)
    except signing.BadSignature:
        return None
    if not isinstance(consent, dict) or consent.get('version') != settings.CONSENT_POLICY_VERSION:
        return None
    if consent.get('necessary') is not True:
        return None
    return build_consent(**{key: consent.get(key, False) for key in OPTIONAL_CATEGORIES})


def set_consent_cookie(response, consent):
    response.set_cookie(
        settings.CONSENT_COOKIE_NAME,
        signing.dumps(consent, salt=CONSENT_SIGNING_SALT, compress=True),
        max_age=settings.CONSENT_COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.CONSENT_COOKIE_SECURE,
        samesite=settings.CONSENT_COOKIE_SAMESITE,
        path='/',
    )

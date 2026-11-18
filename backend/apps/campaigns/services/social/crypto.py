"""Encrypt Page tokens at rest; plaintext tokens never reach logs or API responses."""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .base import SocialProviderError


def _fernet():
    configured = settings.CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY
    if configured:
        try:
            return Fernet(configured.encode())
        except (TypeError, ValueError) as error:
            raise ImproperlyConfigured(
                'CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY must be a valid Fernet key.'
            ) from error
    if settings.IS_PRODUCTION and settings.CAMPAIGN_SOCIAL_PROVIDER == 'facebook':
        raise ImproperlyConfigured('CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY is required.')
    derived = hashlib.sha256(f'{settings.SECRET_KEY}:campaign-social-token'.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_token(token):
    return _fernet().encrypt(token.encode()).decode()


def decrypt_token(ciphertext):
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as error:
        raise SocialProviderError('token_unreadable', token_invalid=True) from error

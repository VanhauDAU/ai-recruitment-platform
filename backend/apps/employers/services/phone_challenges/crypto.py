"""Phone normalisation, keyed fingerprints and the encrypted challenge payload.

The destination and OTP only exist encrypted, and only until the worker sends
the SMS; lookups use HMAC fingerprints so no plaintext number is stored.
"""

from __future__ import annotations

import base64
import hashlib
import hmac

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError

from apps.employers.domain.phone import canonical_vn_mobile

from ..sms_provider import (
    SmsProviderPermanentError,
)


def normalize_vietnamese_mobile(value):
    """Return canonical +84 mobile form or raise a domain validation error."""
    canonical = canonical_vn_mobile(value)
    if canonical is None:
        raise ValidationError('Số điện thoại phải là số di động Việt Nam hợp lệ.')
    return canonical


def _hmac_key():
    configured = settings.EMPLOYER_SMS_CHALLENGE_HMAC_KEY
    if configured:
        return configured.encode()
    if settings.IS_PRODUCTION:
        raise ImproperlyConfigured('EMPLOYER_SMS_CHALLENGE_HMAC_KEY is required.')
    return hmac.new(
        settings.SECRET_KEY.encode(),
        b'employer-sms-development-hmac',
        hashlib.sha256,
    ).digest()


def _payload_fernet():
    configured = settings.EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY
    if configured:
        try:
            return Fernet(configured.encode())
        except (TypeError, ValueError) as error:
            raise ImproperlyConfigured(
                'EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY must be a valid Fernet key.'
            ) from error
    if settings.IS_PRODUCTION:
        raise ImproperlyConfigured('EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY is required.')
    derived = hashlib.sha256(
        f'{settings.SECRET_KEY}:employer-sms-development-payload'.encode()
    ).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def phone_fingerprint(phone):
    canonical = normalize_vietnamese_mobile(phone)
    return hmac.new(_hmac_key(), f'phone:v1:{canonical}'.encode(), hashlib.sha256).hexdigest()


def hash_challenge_code(challenge_public_id, code):
    payload = f'phone-otp:v1:{challenge_public_id}:{code}'.encode()
    return hmac.new(_hmac_key(), payload, hashlib.sha256).hexdigest()


def challenge_code_matches(challenge, code):
    return hmac.compare_digest(
        challenge.code_hash,
        hash_challenge_code(challenge.public_id, code),
    )


def encrypt_payload(value):
    return _payload_fernet().encrypt(value.encode()).decode()


def decrypt_payload(ciphertext):
    try:
        return _payload_fernet().decrypt(ciphertext.encode()).decode()
    except (ImproperlyConfigured, InvalidToken, UnicodeDecodeError, ValueError) as error:
        raise SmsProviderPermanentError('challenge_payload_unreadable') from error


def canonical_variants(canonical_phone):
    return {canonical_phone, f'0{canonical_phone[3:]}'}

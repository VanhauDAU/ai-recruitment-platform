"""Shared deterministic rules for RBAC services and selectors.

This module deliberately performs no database queries and imports no DRF code.
"""

import hashlib
import json

from django.core import signing

IMPACT_TOKEN_MAX_AGE = 600
IMPACT_TOKEN_SALT = 'admin-access-impact'


class InvalidImpactToken(ValueError):
    """The token cannot be trusted or decoded."""


class StaleImpactToken(ValueError):
    """The preview no longer describes the requested operation."""


def select_primary_successor(memberships, *, excluded_membership_ids=frozenset()):
    """Select rank desc, assigned_at asc, id asc from already-valid memberships."""

    excluded = set(excluded_membership_ids)
    candidates = [item for item in memberships if item.pk not in excluded]
    if not candidates:
        return None
    return min(
        candidates,
        key=lambda item: (
            -item.role.rank,
            item.assigned_at,
            item.pk,
        ),
    )


def normalize_impact_payload(payload):
    """Return JSON-stable primitives used by both preview and confirmation."""

    if isinstance(payload, dict):
        return {str(key): normalize_impact_payload(value) for key, value in sorted(payload.items())}
    if isinstance(payload, (list, tuple, set, frozenset)):
        values = [normalize_impact_payload(value) for value in payload]
        return sorted(values, key=lambda value: json.dumps(value, sort_keys=True))
    return payload


def impact_payload_hash(normalized_payload):
    encoded = json.dumps(
        normalize_impact_payload(normalized_payload),
        sort_keys=True,
        separators=(',', ':'),
        ensure_ascii=False,
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def create_impact_token(*, revision, operation, resource_key, normalized_payload):
    signer = signing.TimestampSigner(salt=IMPACT_TOKEN_SALT)
    return signer.sign_object(
        {
            'revision': revision,
            'operation': operation,
            'resource_key': resource_key,
            'payload_hash': impact_payload_hash(normalized_payload),
        }
    )


def decode_impact_token(
    token,
    *,
    operation,
    resource_key,
    normalized_payload,
    max_age=IMPACT_TOKEN_MAX_AGE,
):
    signer = signing.TimestampSigner(salt=IMPACT_TOKEN_SALT)
    try:
        claims = signer.unsign_object(token, max_age=max_age)
    except signing.SignatureExpired as error:
        raise StaleImpactToken('Impact preview đã hết hạn.') from error
    except (signing.BadSignature, TypeError, ValueError) as error:
        raise InvalidImpactToken('Impact token không hợp lệ.') from error

    expected = {
        'operation': operation,
        'resource_key': resource_key,
        'payload_hash': impact_payload_hash(normalized_payload),
    }
    if any(claims.get(key) != value for key, value in expected.items()):
        raise StaleImpactToken('Impact preview không còn khớp với thao tác.')
    if not isinstance(claims.get('revision'), int):
        raise InvalidImpactToken('Impact token không hợp lệ.')
    return claims

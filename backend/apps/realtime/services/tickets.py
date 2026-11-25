"""One-time tickets that bridge an authenticated HTTP request to a socket.

Browsers cannot attach an ``Authorization`` header to a websocket handshake,
and a JWT in the query string would end up in proxy logs for its whole
lifetime. The client therefore trades its access token for a random ticket
that lives 30 seconds and is consumed atomically by the first handshake.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass

from django.core.cache import cache

from apps.accounts.models import User
from apps.accounts.services import atomic_pop, is_account_accessible, is_session_live

from ..domain import TICKET_TTL_SECONDS

_KEY_PREFIX = 'realtime:ticket:'
_MAX_TICKET_LENGTH = 128


@dataclass(frozen=True)
class SocketIdentity:
    user_id: int
    sid: str
    auth_revision: int


def issue_ticket(*, user, validated_token):
    """Bind a new ticket to the exact login session that asked for it."""
    ticket = secrets.token_urlsafe(32)
    cache.set(
        f'{_KEY_PREFIX}{ticket}',
        {
            'user_id': user.pk,
            'sid': str(validated_token.get('sid') or ''),
            'auth_rev': int(validated_token.get('auth_rev', 1)),
        },
        TICKET_TTL_SECONDS,
    )
    return {'ticket': ticket, 'expires_in': TICKET_TTL_SECONDS}


def redeem_ticket(ticket):
    """Consume ``ticket`` once; the identity only if its session is still valid."""
    if not ticket or len(ticket) > _MAX_TICKET_LENGTH:
        return None
    payload = atomic_pop(f'{_KEY_PREFIX}{ticket}')
    if not isinstance(payload, dict):
        return None
    identity = SocketIdentity(
        user_id=int(payload['user_id']),
        sid=payload['sid'],
        auth_revision=int(payload['auth_rev']),
    )
    return identity if identity_is_authorized(identity) else None


def identity_is_authorized(identity):
    """Same rules as the HTTP API: active account, same credentials, live session."""
    user = User.objects.filter(pk=identity.user_id).first()
    return (
        user is not None
        and is_account_accessible(user)
        and is_session_live(sid=identity.sid, user=user, auth_revision=identity.auth_revision)
    )

"""Connecting a recruiter's social network account through OAuth.

The browser comes back to the callback without our JWT, so the recruiter is
identified by a signed ``state`` holding the network and a one-time nonce kept
10 minutes in the cache. Only the chosen account's token is stored, encrypted.
"""

import logging
import secrets
from datetime import timedelta

from django.core import signing
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework.exceptions import ValidationError

from apps.employers.models import EmployerNotification, RecruiterProfile
from apps.employers.services import emit_employer_event
from common.i18n import recipient_language

from ..models import ScheduledSocialPost, SocialAccountConnection
from .social import SocialProviderError, decrypt_token, encrypt_token, get_provider

logger = logging.getLogger(__name__)
INTEGRATIONS_PATH = '/tuyendung/app/account/settings/integrations'
# Refresh a token this long before it expires; the daily task gets several tries.
REFRESH_AHEAD = timedelta(days=10)

STATE_SALT = 'campaign-social-oauth'
OAUTH_TTL = 600


def _nonce_key(nonce):
    return f'social-oauth-nonce:{nonce}'


def _accounts_key(nonce):
    return f'social-oauth-accounts:{nonce}'


def start_connection(user, network):
    nonce = secrets.token_urlsafe(16)
    cache.set(_nonce_key(nonce), user.pk, OAUTH_TTL)
    state = signing.dumps({'u': user.pk, 'n': nonce, 'net': network}, salt=STATE_SALT)
    return get_provider(network).authorize_url(state)


def complete_connection(*, network, code, state):
    """Finish OAuth and park the user's accounts for selection; returns the nonce."""
    try:
        payload = signing.loads(state, salt=STATE_SALT, max_age=OAUTH_TTL)
    except signing.BadSignature as error:
        raise ValidationError({'code': 'SOCIAL_STATE_INVALID'}) from error
    nonce = payload.get('n', '')
    if (
        not nonce
        or payload.get('net') != network
        or cache.get(_nonce_key(nonce)) != payload.get('u')
    ):
        raise ValidationError({'code': 'SOCIAL_STATE_INVALID'})
    cache.delete(_nonce_key(nonce))
    provider = get_provider(network)
    accounts = provider.list_accounts(provider.exchange_code(code))
    cache.set(
        _accounts_key(nonce),
        {
            'user_id': payload['u'],
            'network': network,
            'simulated': provider.simulated,
            'accounts': [
                {
                    'id': account.account_id,
                    'name': account.name,
                    'picture_url': account.picture_url,
                    'token': encrypt_token(account.token),
                    'expires_at': account.expires_at,
                }
                for account in accounts
            ],
        },
        OAUTH_TTL,
    )
    return nonce


def _pending(user, network, nonce):
    pending = cache.get(_accounts_key(nonce))
    if not pending or pending['user_id'] != user.pk or pending['network'] != network:
        raise ValidationError(
            {
                'code': 'SOCIAL_SELECTION_EXPIRED',
                'detail': _('Phiên chọn tài khoản đã hết hạn. Hãy kết nối lại.'),
            }
        )
    return pending


def pending_accounts(user, network, nonce):
    return [
        {'id': account['id'], 'name': account['name'], 'picture_url': account['picture_url']}
        for account in _pending(user, network, nonce)['accounts']
    ]


@transaction.atomic
def select_account(*, user, network, nonce, account_id):
    pending = _pending(user, network, nonce)
    account = next((item for item in pending['accounts'] if item['id'] == account_id), None)
    if account is None:
        raise ValidationError({'account_id': _('Tài khoản không có trong danh sách vừa kết nối.')})
    connection, _created = SocialAccountConnection.objects.update_or_create(
        owner=RecruiterProfile.objects.get(user=user),
        network=network,
        simulated=pending['simulated'],
        account_id=account['id'],
        defaults={
            'account_name': account['name'],
            'account_picture_url': account['picture_url'],
            'token_ciphertext': account['token'],
            'token_expires_at': account.get('expires_at'),
            'status': SocialAccountConnection.Status.CONNECTED,
            'last_error_code': '',
        },
    )
    cache.delete(_accounts_key(nonce))
    return connection


@transaction.atomic
def disconnect_account(*, user, connection):
    if connection.owner.user_id != user.pk:
        raise ValidationError(_('Bạn không có quyền với kết nối này.'))
    connection.status = SocialAccountConnection.Status.REVOKED
    connection.token_ciphertext = ''
    connection.save(update_fields=['status', 'token_ciphertext', 'updated_at'])
    ScheduledSocialPost.objects.filter(
        connection=connection, status__in=ScheduledSocialPost.OPEN_STATUSES
    ).update(status=ScheduledSocialPost.Status.CANCELLED, last_error_code='disconnected')
    return connection


def expire_connection(connection, code):
    """Mark ``connection`` expired and ask its owner to reconnect."""
    SocialAccountConnection.objects.filter(pk=connection.pk).update(
        status=SocialAccountConnection.Status.EXPIRED, last_error_code=code
    )
    recipient = connection.owner.user
    with recipient_language(recipient):
        emit_employer_event(
            recipient=recipient,
            event_type=EmployerNotification.EventType.SOCIAL_CONNECTION_EXPIRED,
            dedupe_key=f'social-connection-expired:{connection.public_id}:{code}',
            message=str(
                gettext_lazy(
                    'Kết nối %(network)s "%(account)s" đã hết hạn. '
                    'Hãy kết nối lại để tiếp tục đăng.'
                )
            )
            % {'network': connection.spec.label, 'account': connection.account_name},
            subject_public_id=connection.public_id,
            action_path=INTEGRATIONS_PATH,
        )


def refresh_expiring_tokens(now=None):
    """Refresh tokens that expire soon; a refused or lapsed one expires the connection."""
    now = now or timezone.now()
    connections = SocialAccountConnection.objects.select_related('owner__user').filter(
        status=SocialAccountConnection.Status.CONNECTED,
        token_expires_at__isnull=False,
        token_expires_at__lte=now + REFRESH_AHEAD,
    )
    refreshed = 0
    for connection in connections:
        try:
            grant = get_provider(connection.network).refresh(
                decrypt_token(connection.token_ciphertext)
            )
        except SocialProviderError as error:
            if error.token_invalid or connection.token_expires_at <= now:
                expire_connection(connection, error.code)
            else:
                logger.warning(
                    'social_token_refresh_failed',
                    extra={'network': connection.network, 'code': error.code},
                )
            continue
        SocialAccountConnection.objects.filter(pk=connection.pk).update(
            token_ciphertext=encrypt_token(grant.token), token_expires_at=grant.expires_at
        )
        refreshed += 1
    return refreshed

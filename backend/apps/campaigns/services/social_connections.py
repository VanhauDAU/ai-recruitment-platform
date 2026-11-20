"""Connecting a recruiter's social network account through OAuth.

The browser comes back to the callback without our JWT, so the recruiter is
identified by a signed ``state`` holding the network and a one-time nonce kept
10 minutes in the cache. Only the chosen account's token is stored, encrypted.
"""

import secrets

from django.core import signing
from django.core.cache import cache
from django.db import transaction
from django.utils.translation import gettext as _
from rest_framework.exceptions import ValidationError

from apps.employers.models import RecruiterProfile

from ..models import ScheduledSocialPost, SocialAccountConnection
from .social import encrypt_token, get_provider

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

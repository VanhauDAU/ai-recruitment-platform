"""Connecting a recruiter's Facebook Page through OAuth.

The browser comes back to the callback without our JWT, so the recruiter is
identified by a signed ``state`` holding a one-time nonce kept 10 minutes in
the cache. Only the chosen Page's token is stored, encrypted.
"""

import secrets

from django.conf import settings
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


def _pages_key(nonce):
    return f'social-oauth-pages:{nonce}'


def start_page_connection(user):
    nonce = secrets.token_urlsafe(16)
    cache.set(_nonce_key(nonce), user.pk, OAUTH_TTL)
    state = signing.dumps({'u': user.pk, 'n': nonce}, salt=STATE_SALT)
    return get_provider().authorize_url(state)


def complete_page_connection(*, code, state):
    """Finish OAuth and park the user's Pages for selection; returns the nonce."""
    try:
        payload = signing.loads(state, salt=STATE_SALT, max_age=OAUTH_TTL)
    except signing.BadSignature as error:
        raise ValidationError({'code': 'SOCIAL_STATE_INVALID'}) from error
    nonce = payload.get('n', '')
    if not nonce or cache.get(_nonce_key(nonce)) != payload.get('u'):
        raise ValidationError({'code': 'SOCIAL_STATE_INVALID'})
    cache.delete(_nonce_key(nonce))
    provider = get_provider()
    pages = provider.list_pages(provider.exchange_code(code))
    cache.set(
        _pages_key(nonce),
        {
            'user_id': payload['u'],
            'pages': [
                {
                    'id': page.page_id,
                    'name': page.name,
                    'picture_url': page.picture_url,
                    'token': encrypt_token(page.token),
                }
                for page in pages
            ],
        },
        OAUTH_TTL,
    )
    return nonce


def _pending(user, nonce):
    pending = cache.get(_pages_key(nonce))
    if not pending or pending['user_id'] != user.pk:
        raise ValidationError(
            {
                'code': 'SOCIAL_SELECTION_EXPIRED',
                'detail': _('Phiên chọn Fanpage đã hết hạn. Hãy kết nối lại.'),
            }
        )
    return pending


def pending_pages(user, nonce):
    return [
        {'id': page['id'], 'name': page['name'], 'picture_url': page['picture_url']}
        for page in _pending(user, nonce)['pages']
    ]


@transaction.atomic
def select_page(*, user, nonce, page_id):
    page = next((item for item in _pending(user, nonce)['pages'] if item['id'] == page_id), None)
    if page is None:
        raise ValidationError({'page_id': _('Fanpage không có trong danh sách vừa kết nối.')})
    connection, _created = SocialAccountConnection.objects.update_or_create(
        owner=RecruiterProfile.objects.get(user=user),
        provider=settings.CAMPAIGN_SOCIAL_PROVIDER,
        page_id=page['id'],
        defaults={
            'page_name': page['name'],
            'page_picture_url': page['picture_url'],
            'token_ciphertext': page['token'],
            'status': SocialAccountConnection.Status.CONNECTED,
            'last_error_code': '',
        },
    )
    cache.delete(_pages_key(nonce))
    return connection


@transaction.atomic
def disconnect_page(*, user, connection):
    if connection.owner.user_id != user.pk:
        raise ValidationError(_('Bạn không có quyền với kết nối này.'))
    connection.status = SocialAccountConnection.Status.REVOKED
    connection.token_ciphertext = ''
    connection.save(update_fields=['status', 'token_ciphertext', 'updated_at'])
    ScheduledSocialPost.objects.filter(
        connection=connection, status__in=ScheduledSocialPost.OPEN_STATUSES
    ).update(status=ScheduledSocialPost.Status.CANCELLED, last_error_code='disconnected')
    return connection

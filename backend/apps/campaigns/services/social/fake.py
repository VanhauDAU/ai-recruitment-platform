"""In-process stand-in for a network so the whole flow runs in dev, CI and demos."""

import secrets
from urllib.parse import urlencode

from django.core.cache import cache

from ...domain.social_networks import NETWORKS
from .base import PublishedPost, SocialAccount


class FakeProvider:
    simulated = True

    def __init__(self, network):
        self.network = network
        self.spec = NETWORKS[network]

    def authorize_url(self, state):
        from .registry import oauth_redirect_uri

        query = urlencode({'code': 'fake-code', 'state': state})
        return f'{oauth_redirect_uri(self.network)}?{query}'

    def exchange_code(self, code):
        return 'fake-user-token'

    def list_accounts(self, user_token):
        return [
            SocialAccount(
                account_id=f'fake-{self.network}-1',
                name=f'{self.spec.label} thử nghiệm (giả lập)',
                picture_url='',
                token='fake-account-token',
            )
        ]

    def publish(self, *, account_id, token, message, link, images=()):
        post_id = f'{account_id}_{secrets.token_hex(6)}'
        cache.set(
            f'fake-social-post:{post_id}',
            {'message': message, 'link': link, 'images': [name for name, _ in images]},
            86400,
        )
        return PublishedPost(post_id=post_id, permalink=f'https://example.com/{post_id}')

    def find_recent_post(self, *, account_id, token, link):
        return None

    def delete(self, *, post_id, token):
        cache.delete(f'fake-social-post:{post_id}')

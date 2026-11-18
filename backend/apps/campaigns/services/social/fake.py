"""In-process stand-in for Facebook so the whole flow runs in dev, CI and demos."""

import secrets
from urllib.parse import urlencode

from django.conf import settings
from django.core.cache import cache

from .base import PublishedPost, SocialPage

FAKE_PAGE = SocialPage(
    page_id='fake-page-1',
    name='Fanpage thử nghiệm (giả lập)',
    picture_url='',
    token='fake-page-token',
)


class FakePageProvider:
    name = 'fake'

    def authorize_url(self, state):
        query = urlencode({'code': 'fake-code', 'state': state})
        return f'{settings.FACEBOOK_OAUTH_REDIRECT_URI}?{query}'

    def exchange_code(self, code):
        return 'fake-user-token'

    def list_pages(self, user_token):
        return [FAKE_PAGE]

    def publish(self, *, page_id, page_token, message, link, images=()):
        post_id = f'{page_id}_{secrets.token_hex(6)}'
        cache.set(
            f'fake-social-post:{post_id}',
            {'message': message, 'link': link, 'images': [name for name, _ in images]},
            86400,
        )
        return PublishedPost(post_id=post_id, permalink=f'https://www.facebook.com/{post_id}')

    def find_recent_post(self, *, page_id, page_token, link):
        return None

    def delete(self, *, post_id, page_token):
        cache.delete(f'fake-social-post:{post_id}')

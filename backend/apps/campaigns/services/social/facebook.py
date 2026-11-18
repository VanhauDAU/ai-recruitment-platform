"""Facebook Graph API adapter (Pages): OAuth, list pages, publish, find and delete posts."""

import hashlib
import hmac
from urllib.parse import urlencode

import requests
from django.conf import settings

from .base import PublishedPost, SocialPage, SocialProviderError

SCOPES = 'pages_show_list,pages_manage_posts,pages_read_engagement'
TOKEN_ERROR_CODES = {190, 102}
PERMANENT_ERROR_CODES = {10, 200, 368, 100}
TRANSIENT_ERROR_CODES = {1, 2, 4, 17, 32, 341, 613}


class FacebookPageProvider:
    name = 'facebook'

    def __init__(self, session=None):
        self.session = session or requests.Session()
        self.version = settings.FACEBOOK_GRAPH_API_VERSION
        self.timeout = settings.CAMPAIGN_SOCIAL_HTTP_TIMEOUT_SECONDS

    def _url(self, path):
        return f'https://graph.facebook.com/{self.version}/{path.lstrip("/")}'

    def _proof(self, token):
        return hmac.new(
            settings.FACEBOOK_APP_SECRET.encode(), token.encode(), hashlib.sha256
        ).hexdigest()

    def _call(self, method, path, *, token=None, params=None, data=None):
        params = dict(params or {})
        if token:
            params.update(access_token=token, appsecret_proof=self._proof(token))
        try:
            response = self.session.request(
                method, self._url(path), params=params, data=data, timeout=self.timeout
            )
        except requests.Timeout as error:
            raise SocialProviderError('timeout', transient=True) from error
        except requests.RequestException as error:
            raise SocialProviderError('network_error', transient=True) from error
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        if response.status_code >= 500:
            raise SocialProviderError(f'http_{response.status_code}', transient=True)
        error = payload.get('error') if isinstance(payload, dict) else None
        if error or response.status_code >= 400:
            code = int((error or {}).get('code') or 0)
            raise SocialProviderError(
                f'graph_{code or response.status_code}',
                transient=code in TRANSIENT_ERROR_CODES,
                token_invalid=code in TOKEN_ERROR_CODES,
            )
        return payload

    def authorize_url(self, state):
        query = urlencode(
            {
                'client_id': settings.FACEBOOK_APP_ID,
                'redirect_uri': settings.FACEBOOK_OAUTH_REDIRECT_URI,
                'state': state,
                'scope': SCOPES,
                'response_type': 'code',
            }
        )
        return f'https://www.facebook.com/{self.version}/dialog/oauth?{query}'

    def exchange_code(self, code):
        """Authorization code to a long-lived user token."""
        app = {'client_id': settings.FACEBOOK_APP_ID, 'client_secret': settings.FACEBOOK_APP_SECRET}
        short = self._call(
            'GET',
            'oauth/access_token',
            params={**app, 'redirect_uri': settings.FACEBOOK_OAUTH_REDIRECT_URI, 'code': code},
        )
        long_lived = self._call(
            'GET',
            'oauth/access_token',
            params={
                **app,
                'grant_type': 'fb_exchange_token',
                'fb_exchange_token': short['access_token'],
            },
        )
        return long_lived['access_token']

    def list_pages(self, user_token):
        payload = self._call(
            'GET',
            'me/accounts',
            token=user_token,
            params={'fields': 'id,name,access_token,picture{url}', 'limit': 50},
        )
        return [
            SocialPage(
                page_id=str(page['id']),
                name=page.get('name', '')[:255],
                picture_url=((page.get('picture') or {}).get('data') or {}).get('url', ''),
                token=page['access_token'],
            )
            for page in payload.get('data', [])
            if page.get('access_token')
        ]

    def publish(self, *, page_id, page_token, message, link):
        created = self._call(
            'POST', f'{page_id}/feed', token=page_token, data={'message': message, 'link': link}
        )
        post_id = created['id']
        details = self._call('GET', post_id, token=page_token, params={'fields': 'permalink_url'})
        return PublishedPost(post_id=post_id, permalink=details.get('permalink_url', ''))

    def find_recent_post(self, *, page_id, page_token, link):
        """Post already carrying ``link`` (a publish that timed out may have succeeded)."""
        payload = self._call(
            'GET',
            f'{page_id}/published_posts',
            token=page_token,
            params={'fields': 'id,message,permalink_url', 'limit': 10},
        )
        for post in payload.get('data', []):
            if link in (post.get('message') or ''):
                return PublishedPost(post_id=post['id'], permalink=post.get('permalink_url', ''))
        return None

    def delete(self, *, post_id, page_token):
        try:
            self._call('DELETE', post_id, token=page_token)
        except SocialProviderError as error:
            if error.code in {'graph_100', 'http_404'}:
                return  # already gone
            raise

"""Shared Meta Graph API client for Facebook Pages, Instagram and Threads.

Facebook Pages and Instagram use the Facebook Login dialog, token exchange and
``appsecret_proof`` signing; Threads has its own host and login but the same
request shape, error format and media containers. Each provider adds its
scopes, accounts and publishing calls.
"""

import hashlib
import hmac
import ipaddress
import time
from urllib.parse import urlencode, urlsplit

import requests
from django.conf import settings

from .base import SocialProviderError
from .registry import oauth_redirect_uri

TOKEN_ERROR_CODES = {190, 102}
TRANSIENT_ERROR_CODES = {1, 2, 4, 17, 32, 341, 613}


def is_public_url(url):
    """Whether Facebook's crawler can fetch ``url`` to build a link preview.

    Graph rejects a ``link`` it cannot reach (error 1500), which is every
    local development address.
    """
    parts = urlsplit(url or '')
    host = (parts.hostname or '').lower()
    if parts.scheme not in {'http', 'https'} or not host:
        return False
    if host == 'localhost' or host.endswith(('.localhost', '.local', '.test', '.internal')):
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return '.' in host
    return address.is_global


class MetaGraphProvider:
    network = ''
    simulated = False
    scopes = ''
    graph_host = 'https://graph.facebook.com'
    sign_requests = True  # appsecret_proof; the Threads API does not use it
    transient_error_codes = TRANSIENT_ERROR_CODES
    # Media containers: the field holding their status, and how long to poll it.
    container_status_field = 'status_code'
    container_checks = 5
    container_wait_seconds = 2

    def __init__(self, session=None, sleep=time.sleep):
        self.session = session or requests.Session()
        self.sleep = sleep
        self.version = self.api_version()
        self.timeout = settings.CAMPAIGN_SOCIAL_HTTP_TIMEOUT_SECONDS
        self.redirect_uri = oauth_redirect_uri(self.network)

    def api_version(self):
        return settings.FACEBOOK_GRAPH_API_VERSION

    def _url(self, path):
        return f'{self.graph_host}/{self.version}/{path.lstrip("/")}'

    def _proof(self, token):
        return hmac.new(
            settings.FACEBOOK_APP_SECRET.encode(), token.encode(), hashlib.sha256
        ).hexdigest()

    def _call(self, method, path, *, token=None, params=None, data=None, files=None):
        params = dict(params or {})
        if token:
            params['access_token'] = token
            if self.sign_requests:
                params['appsecret_proof'] = self._proof(token)
        try:
            response = self.session.request(
                method,
                self._url(path),
                params=params,
                data=data,
                files=files,
                timeout=self.timeout,
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
                transient=code in self.transient_error_codes,
                token_invalid=code in TOKEN_ERROR_CODES,
            )
        return payload

    def authorize_url(self, state):
        query = urlencode(
            {
                'client_id': settings.FACEBOOK_APP_ID,
                'redirect_uri': self.redirect_uri,
                'state': state,
                'scope': self.scopes,
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
            params={**app, 'redirect_uri': self.redirect_uri, 'code': code},
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

    def _wait_until_ready(self, container_id, token):
        for attempt in range(self.container_checks):
            status = self._call(
                'GET', container_id, token=token, params={'fields': self.container_status_field}
            ).get(self.container_status_field)
            if status in {'FINISHED', 'PUBLISHED'}:
                return
            if status in {'ERROR', 'EXPIRED'}:
                raise SocialProviderError('container_error')
            if attempt < self.container_checks - 1:
                self.sleep(self.container_wait_seconds)
        raise SocialProviderError('container_pending', transient=True)

    def _container(self, path, token, data):
        """Create a media container under ``path`` and wait until it can be published."""
        container_id = self._call('POST', path, token=token, data=data)['id']
        self._wait_until_ready(container_id, token)
        return container_id

    def _delete_object(self, object_id, token):
        try:
            self._call('DELETE', object_id, token=token)
        except SocialProviderError as error:
            if error.code in {'graph_100', 'http_404'}:
                return  # already gone
            raise

"""Shared Meta Graph API client for providers that sign in through Facebook Login.

Facebook Pages and Instagram professional accounts use the same OAuth dialog,
token exchange, ``appsecret_proof`` signing and error codes; each provider adds
its own scopes, accounts and publishing calls.
"""

import hashlib
import hmac
from urllib.parse import urlencode

import requests
from django.conf import settings

from .base import SocialProviderError
from .registry import oauth_redirect_uri

TOKEN_ERROR_CODES = {190, 102}
TRANSIENT_ERROR_CODES = {1, 2, 4, 17, 32, 341, 613}


class MetaGraphProvider:
    network = ''
    simulated = False
    scopes = ''
    transient_error_codes = TRANSIENT_ERROR_CODES

    def __init__(self, session=None):
        self.session = session or requests.Session()
        self.version = settings.FACEBOOK_GRAPH_API_VERSION
        self.timeout = settings.CAMPAIGN_SOCIAL_HTTP_TIMEOUT_SECONDS
        self.redirect_uri = oauth_redirect_uri(self.network)

    def _url(self, path):
        return f'https://graph.facebook.com/{self.version}/{path.lstrip("/")}'

    def _proof(self, token):
        return hmac.new(
            settings.FACEBOOK_APP_SECRET.encode(), token.encode(), hashlib.sha256
        ).hexdigest()

    def _call(self, method, path, *, token=None, params=None, data=None, files=None):
        params = dict(params or {})
        if token:
            params.update(access_token=token, appsecret_proof=self._proof(token))
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

    def _delete_object(self, object_id, token):
        try:
            self._call('DELETE', object_id, token=token)
        except SocialProviderError as error:
            if error.code in {'graph_100', 'http_404'}:
                return  # already gone
            raise

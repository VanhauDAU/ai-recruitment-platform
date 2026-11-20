"""LinkedIn member posts through "Share on LinkedIn" (versioned Posts API).

The member signs in with OpenID Connect (``openid profile``) plus
``w_member_social``; ``userinfo.sub`` is the person id behind
``urn:li:person:<id>``. The 60-day token cannot be refreshed by self-serve
apps, so the recruiter is reminded to reconnect. Images are uploaded first
(Images API) and attached by URN. LinkedIn does not let these apps list a
member's posts, so a retry cannot look for a post that a timed-out call made.
"""

from datetime import timedelta
from urllib.parse import quote, urlencode

import requests
from django.conf import settings
from django.utils import timezone

from ...domain.social_networks import LINKEDIN
from .base import PublishedPost, SocialAccount, SocialProviderError, TokenGrant
from .registry import oauth_redirect_uri

SCOPES = 'openid profile w_member_social'
# ``commentary`` uses LinkedIn's "little" text format: these characters must be
# escaped or the text is cut at the first one.
RESERVED = set('\\|{}@[]()<>#*_~')


def little_text(text):
    return ''.join(f'\\{char}' if char in RESERVED else char for char in text)


def _client():
    return (
        settings.LINKEDIN_SOCIAL_CLIENT_ID or settings.OAUTH_LINKEDIN_CLIENT_ID,
        settings.LINKEDIN_SOCIAL_CLIENT_SECRET or settings.OAUTH_LINKEDIN_CLIENT_SECRET,
    )


class LinkedInProvider:
    network = LINKEDIN
    simulated = False

    def __init__(self, session=None):
        self.session = session or requests.Session()
        self.timeout = settings.CAMPAIGN_SOCIAL_HTTP_TIMEOUT_SECONDS
        self.redirect_uri = oauth_redirect_uri(self.network)

    def _request(self, method, url, *, token=None, **kwargs):
        headers = kwargs.pop('headers', {})
        if token:
            headers['Authorization'] = f'Bearer {token}'
        try:
            response = self.session.request(
                method, url, headers=headers, timeout=self.timeout, **kwargs
            )
        except requests.Timeout as error:
            raise SocialProviderError('timeout', transient=True) from error
        except requests.RequestException as error:
            raise SocialProviderError('network_error', transient=True) from error
        status = response.status_code
        if status >= 400:
            raise SocialProviderError(
                f'linkedin_{status}',
                transient=status == 429 or status >= 500,
                token_invalid=status == 401,
            )
        return response

    def _rest(self, method, path, *, token, json=None, params=None):
        return self._request(
            method,
            f'https://api.linkedin.com/rest/{path}',
            token=token,
            json=json,
            params=params,
            headers={
                'Linkedin-Version': settings.LINKEDIN_API_VERSION,
                'X-Restli-Protocol-Version': '2.0.0',
            },
        )

    def authorize_url(self, state):
        client_id, _secret = _client()
        query = urlencode(
            {
                'response_type': 'code',
                'client_id': client_id,
                'redirect_uri': self.redirect_uri,
                'state': state,
                'scope': SCOPES,
            }
        )
        return f'https://www.linkedin.com/oauth/v2/authorization?{query}'

    def exchange_code(self, code):
        client_id, secret = _client()
        payload = self._request(
            'POST',
            'https://www.linkedin.com/oauth/v2/accessToken',
            data={
                'grant_type': 'authorization_code',
                'code': code,
                'client_id': client_id,
                'client_secret': secret,
                'redirect_uri': self.redirect_uri,
            },
        ).json()
        seconds = payload.get('expires_in')
        expires_at = timezone.now() + timedelta(seconds=int(seconds)) if seconds else None
        return TokenGrant(token=payload['access_token'], expires_at=expires_at)

    def list_accounts(self, grant):
        profile = self._request(
            'GET', 'https://api.linkedin.com/v2/userinfo', token=grant.token
        ).json()
        return [
            SocialAccount(
                account_id=str(profile['sub']),
                name=(profile.get('name') or '')[:255],
                picture_url=profile.get('picture', ''),
                token=grant.token,
                expires_at=grant.expires_at,
            )
        ]

    def _upload_image(self, author, token, image):
        upload = self._rest(
            'POST',
            'images',
            token=token,
            params={'action': 'initializeUpload'},
            json={'initializeUploadRequest': {'owner': author}},
        ).json()['value']
        self._request('PUT', upload['uploadUrl'], token=token, data=image.content)
        return upload['image']

    def publish(self, *, account_id, token, message, link, images=()):
        author = f'urn:li:person:{account_id}'
        text = message if not link or link in message else f'{message}\n\n{link}'
        body = {
            'author': author,
            'commentary': little_text(text),
            'visibility': 'PUBLIC',
            'distribution': {
                'feedDistribution': 'MAIN_FEED',
                'targetEntities': [],
                'thirdPartyDistributionChannels': [],
            },
            'lifecycleState': 'PUBLISHED',
            'isReshareDisabledByAuthor': False,
        }
        image_urns = [self._upload_image(author, token, image) for image in images]
        if len(image_urns) == 1:
            body['content'] = {'media': {'id': image_urns[0]}}
        elif image_urns:
            body['content'] = {'multiImage': {'images': [{'id': urn} for urn in image_urns]}}
        try:
            response = self._rest('POST', 'posts', token=token, json=body)
        except SocialProviderError as error:
            if error.code in {'timeout', 'network_error'}:
                # The post may exist and cannot be looked up: do not retry blindly.
                raise SocialProviderError('post_result_unknown') from error
            raise
        post_urn = response.headers.get('x-restli-id', '')
        if not post_urn:
            raise SocialProviderError('linkedin_missing_post_id')
        return PublishedPost(
            post_id=post_urn, permalink=f'https://www.linkedin.com/feed/update/{post_urn}/'
        )

    def find_recent_post(self, *, account_id, token, link):
        return None  # listing a member's posts needs r_member_social (restricted)

    def delete(self, *, post_id, token):
        try:
            self._rest('DELETE', f'posts/{quote(post_id, safe="")}', token=token)
        except SocialProviderError as error:
            if error.code == 'linkedin_404':
                return  # already gone
            raise

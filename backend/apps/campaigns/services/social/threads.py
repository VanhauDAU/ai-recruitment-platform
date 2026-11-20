"""Threads profiles through Threads Login (Threads API on graph.threads.com).

The profile's own long-lived token publishes; it lasts 60 days and is
refreshed by a daily task. A post is a container (text, one image or a
carousel) that Threads fetches from public image URLs, then
``threads_publish``. A text-only post gets the tracking link as a preview card.
"""

from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.utils import timezone

from ...domain.social_networks import THREADS
from .base import PublishedPost, SocialAccount, TokenGrant
from .meta_graph import MetaGraphProvider, is_public_url


def _grant(payload):
    seconds = payload.get('expires_in')
    expires_at = timezone.now() + timedelta(seconds=int(seconds)) if seconds else None
    return TokenGrant(token=payload['access_token'], expires_at=expires_at)


class ThreadsProvider(MetaGraphProvider):
    network = THREADS
    scopes = 'threads_basic,threads_content_publish,threads_delete'
    graph_host = 'https://graph.threads.com'
    sign_requests = False
    container_status_field = 'status'
    # Meta suggests waiting about 30 seconds before publishing a container.
    container_checks = 10
    container_wait_seconds = 3

    def api_version(self):
        return settings.THREADS_GRAPH_API_VERSION

    def authorize_url(self, state):
        query = urlencode(
            {
                'client_id': settings.THREADS_APP_ID,
                'redirect_uri': self.redirect_uri,
                'state': state,
                'scope': self.scopes,
                'response_type': 'code',
            }
        )
        return f'https://threads.com/oauth/authorize?{query}'

    def exchange_code(self, code):
        """Authorization code to a 60-day token (``TokenGrant``)."""
        short = self._call(
            'POST',
            'oauth/access_token',
            data={
                'client_id': settings.THREADS_APP_ID,
                'client_secret': settings.THREADS_APP_SECRET,
                'grant_type': 'authorization_code',
                'redirect_uri': self.redirect_uri,
                'code': code,
            },
        )
        return _grant(
            self._call(
                'GET',
                'access_token',
                params={
                    'grant_type': 'th_exchange_token',
                    'client_secret': settings.THREADS_APP_SECRET,
                    'access_token': short['access_token'],
                },
            )
        )

    def refresh(self, token):
        return _grant(
            self._call(
                'GET',
                'refresh_access_token',
                params={'grant_type': 'th_refresh_token', 'access_token': token},
            )
        )

    def _url(self, path):
        # Token endpoints sit at the host root; the rest of the API is versioned.
        path = path.lstrip('/')
        if path in {'oauth/access_token', 'access_token', 'refresh_access_token'}:
            return f'{self.graph_host}/{path}'
        return super()._url(path)

    def list_accounts(self, grant):
        profile = self._call(
            'GET',
            'me',
            token=grant.token,
            params={'fields': 'id,username,threads_profile_picture_url'},
        )
        return [
            SocialAccount(
                account_id=str(profile['id']),
                name=f'@{profile.get("username", "")}'[:255],
                picture_url=profile.get('threads_profile_picture_url', ''),
                token=grant.token,
                expires_at=grant.expires_at,
            )
        ]

    def publish(self, *, account_id, token, message, link, images=()):
        text = message if not link or link in message else f'{message}\n\n{link}'
        path = f'{account_id}/threads'
        if not images:
            data = {'media_type': 'TEXT', 'text': text}
            if is_public_url(link):
                data['link_attachment'] = link  # preview card for text posts
            creation_id = self._container(path, token, data)
        elif len(images) == 1:
            creation_id = self._container(
                path, token, {'media_type': 'IMAGE', 'image_url': images[0].url, 'text': text}
            )
        else:
            children = [
                self._container(
                    path,
                    token,
                    {'media_type': 'IMAGE', 'image_url': image.url, 'is_carousel_item': 'true'},
                )
                for image in images
            ]
            creation_id = self._container(
                path,
                token,
                {'media_type': 'CAROUSEL', 'children': ','.join(children), 'text': text},
            )
        media_id = self._call(
            'POST', f'{account_id}/threads_publish', token=token, data={'creation_id': creation_id}
        )['id']
        details = self._call('GET', media_id, token=token, params={'fields': 'permalink'})
        return PublishedPost(post_id=media_id, permalink=details.get('permalink', ''))

    def find_recent_post(self, *, account_id, token, link):
        payload = self._call(
            'GET',
            f'{account_id}/threads',
            token=token,
            params={'fields': 'id,text,permalink', 'limit': 10},
        )
        for thread in payload.get('data', []):
            if link in (thread.get('text') or ''):
                return PublishedPost(post_id=thread['id'], permalink=thread.get('permalink', ''))
        return None

    def delete(self, *, post_id, token):
        self._delete_object(post_id, token)

"""Instagram professional accounts through Facebook Login (Instagram Graph API).

The account must be linked to a Facebook Page; its Page token publishes. A post
is a media container (one image, or a carousel of child containers) that
Instagram fetches from public image URLs, then ``media_publish``. Links in a
caption are plain text on Instagram, so the tracking link is written out.
"""

import time

from ...domain.social_networks import INSTAGRAM
from .base import PublishedPost, SocialAccount, SocialProviderError
from .meta_graph import TRANSIENT_ERROR_CODES, MetaGraphProvider

# Instagram fetches the images itself; Meta suggests polling the container status.
CONTAINER_CHECKS = 5
CONTAINER_WAIT_SECONDS = 2


class InstagramProvider(MetaGraphProvider):
    network = INSTAGRAM
    # business_management: without it Pages in a business portfolio come back
    # without their linked instagram_business_account (seen 2026-11-20).
    scopes = (
        'business_management,pages_show_list,pages_read_engagement,'
        'instagram_basic,instagram_content_publish,instagram_manage_contents'
    )
    # Code 9 is the 24-hour publishing limit: waiting and retrying is the fix.
    transient_error_codes = TRANSIENT_ERROR_CODES | {9}

    def __init__(self, session=None, sleep=time.sleep):
        super().__init__(session)
        self.sleep = sleep

    def list_accounts(self, user_token):
        """Instagram accounts linked to the user's Pages; Pages without one are skipped."""
        payload = self._call(
            'GET',
            'me/accounts',
            token=user_token,
            params={
                'fields': 'id,name,access_token,'
                'instagram_business_account{id,username,profile_picture_url}',
                'limit': 50,
            },
        )
        accounts = []
        for page in payload.get('data', []):
            instagram = page.get('instagram_business_account') or {}
            if not (instagram.get('id') and page.get('access_token')):
                continue
            username = instagram.get('username') or page.get('name', '')
            accounts.append(
                SocialAccount(
                    account_id=str(instagram['id']),
                    name=f'@{username}'[:255],
                    picture_url=instagram.get('profile_picture_url', ''),
                    token=page['access_token'],
                )
            )
        return accounts

    def _wait_until_ready(self, container_id, token):
        for attempt in range(CONTAINER_CHECKS):
            status = self._call(
                'GET', container_id, token=token, params={'fields': 'status_code'}
            ).get('status_code')
            if status in {'FINISHED', 'PUBLISHED'}:
                return
            if status in {'ERROR', 'EXPIRED'}:
                raise SocialProviderError('ig_container_error')
            if attempt < CONTAINER_CHECKS - 1:
                self.sleep(CONTAINER_WAIT_SECONDS)
        raise SocialProviderError('ig_container_pending', transient=True)

    def _container(self, account_id, token, data):
        container_id = self._call('POST', f'{account_id}/media', token=token, data=data)['id']
        self._wait_until_ready(container_id, token)
        return container_id

    def publish(self, *, account_id, token, message, link, images=()):
        if not images:
            raise SocialProviderError('image_required')
        caption = message if not link or link in message else f'{message}\n\n{link}'
        if len(images) == 1:
            creation_id = self._container(
                account_id, token, {'image_url': images[0].url, 'caption': caption}
            )
        else:
            children = [
                self._container(
                    account_id, token, {'image_url': image.url, 'is_carousel_item': 'true'}
                )
                for image in images
            ]
            creation_id = self._container(
                account_id,
                token,
                {'media_type': 'CAROUSEL', 'children': ','.join(children), 'caption': caption},
            )
        media_id = self._call(
            'POST', f'{account_id}/media_publish', token=token, data={'creation_id': creation_id}
        )['id']
        details = self._call('GET', media_id, token=token, params={'fields': 'permalink'})
        return PublishedPost(post_id=media_id, permalink=details.get('permalink', ''))

    def find_recent_post(self, *, account_id, token, link):
        payload = self._call(
            'GET',
            f'{account_id}/media',
            token=token,
            params={'fields': 'id,caption,permalink', 'limit': 10},
        )
        for media in payload.get('data', []):
            if link in (media.get('caption') or ''):
                return PublishedPost(post_id=media['id'], permalink=media.get('permalink', ''))
        return None

    def delete(self, *, post_id, token):
        self._delete_object(post_id, token)

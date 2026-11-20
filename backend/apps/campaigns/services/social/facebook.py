"""Facebook Graph API adapter (Pages): list pages, publish, find and delete posts."""

import json

from ...domain.social_networks import FACEBOOK_PAGE
from .base import PublishedPost, SocialAccount
from .meta_graph import MetaGraphProvider, is_public_url


class FacebookPageProvider(MetaGraphProvider):
    network = FACEBOOK_PAGE
    scopes = 'pages_show_list,pages_manage_posts,pages_read_engagement'

    def list_accounts(self, user_token):
        payload = self._call(
            'GET',
            'me/accounts',
            token=user_token,
            params={'fields': 'id,name,access_token,picture{url}', 'limit': 50},
        )
        return [
            SocialAccount(
                account_id=str(page['id']),
                name=page.get('name', '')[:255],
                picture_url=((page.get('picture') or {}).get('data') or {}).get('url', ''),
                token=page['access_token'],
            )
            for page in payload.get('data', [])
            if page.get('access_token')
        ]

    def publish(self, *, account_id, token, message, link, images=()):
        data = {'message': message}
        if images:
            # Photos are uploaded unpublished, then attached to one feed post.
            # Graph ignores ``link`` next to attached media, so it stays in the text.
            for index, image in enumerate(images):
                photo = self._call(
                    'POST',
                    f'{account_id}/photos',
                    token=token,
                    data={'published': 'false'},
                    files={'source': (image.name, image.content)},
                )
                data[f'attached_media[{index}]'] = json.dumps({'media_fbid': photo['id']})
            if link and link not in message:
                data['message'] = f'{message}\n\n{link}'
        elif is_public_url(link):
            data['link'] = link  # Facebook renders a preview card for it
        elif link and link not in message:
            data['message'] = f'{message}\n\n{link}'
        created = self._call('POST', f'{account_id}/feed', token=token, data=data)
        post_id = created['id']
        details = self._call('GET', post_id, token=token, params={'fields': 'permalink_url'})
        return PublishedPost(post_id=post_id, permalink=details.get('permalink_url', ''))

    def find_recent_post(self, *, account_id, token, link):
        """Post already carrying ``link`` (a publish that timed out may have succeeded)."""
        payload = self._call(
            'GET',
            f'{account_id}/published_posts',
            token=token,
            params={'fields': 'id,message,permalink_url', 'limit': 10},
        )
        for post in payload.get('data', []):
            if link in (post.get('message') or ''):
                return PublishedPost(post_id=post['id'], permalink=post.get('permalink_url', ''))
        return None

    def delete(self, *, post_id, token):
        self._delete_object(post_id, token)

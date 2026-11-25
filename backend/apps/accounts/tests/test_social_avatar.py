"""Chép avatar của provider social vào storage nội bộ khi đăng nhập."""

import shutil
from unittest.mock import MagicMock, patch

import requests
from django.test import TestCase, override_settings

from apps.accounts.services import oauth, social_avatar
from common.storage.r2 import public_media_storage

from ..models import User
from .factories import GOOGLE_PROFILE, PNG_BYTES, TEST_MEDIA_ROOT

GOOGLE_AVATAR = 'https://lh3.googleusercontent.com/a/ACg8oc-photo=s96-c'


def _response(body=PNG_BYTES):
    resp = MagicMock()
    resp.iter_content.return_value = [body]
    get = MagicMock()
    get.return_value.__enter__.return_value = resp
    return get


@override_settings(
    MEDIA_ROOT=TEST_MEDIA_ROOT,
    OAUTH_GOOGLE_CLIENT_ID='test-client-id',
    OAUTH_GOOGLE_CLIENT_SECRET='test-client-secret',
)
class ProviderAvatarImportTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def _login(self, get, avatar=GOOGLE_AVATAR):
        profile = dict(GOOGLE_PROFILE, avatar=avatar)
        with (
            patch.object(oauth, 'exchange_code', return_value='provider-token'),
            patch.object(oauth, 'fetch_profile', return_value=profile),
            patch.object(social_avatar.requests, 'get', get),
        ):
            code = oauth.complete_provider_login('google', 'code', 'https://cb', 'main')
        return oauth.redeem_one_time_code(code)

    def test_new_google_account_stores_avatar_in_media_storage(self):
        get = _response()
        user = self._login(get)

        self.assertTrue(user.avatar_url.startswith(f'users/avatars/{user.public_id}/'))
        self.assertTrue(public_media_storage().exists(user.avatar_url))
        # Xin ảnh 256px thay vì 96px mặc định của userinfo.
        self.assertEqual(get.call_args.args[0], GOOGLE_AVATAR.replace('=s96-c', '=s256-c'))
        self.assertFalse(get.call_args.kwargs['allow_redirects'])

    def test_legacy_external_url_is_replaced_on_next_login(self):
        User.objects.create_user(
            email=GOOGLE_PROFILE['email'], password=None, avatar_url=GOOGLE_AVATAR
        )
        user = self._login(_response())
        self.assertTrue(user.avatar_url.startswith('users/avatars/'))

    def test_uploaded_avatar_is_kept(self):
        User.objects.create_user(
            email=GOOGLE_PROFILE['email'], password=None, avatar_url='users/avatars/mine.png'
        )
        get = _response()
        user = self._login(get)
        self.assertEqual(user.avatar_url, 'users/avatars/mine.png')
        get.assert_not_called()

    def test_unknown_host_is_never_fetched(self):
        get = _response()
        user = self._login(get, avatar='https://169.254.169.254/latest/meta-data')
        self.assertEqual(user.avatar_url, '')
        get.assert_not_called()

    def test_download_failure_does_not_block_login(self):
        get = MagicMock(side_effect=requests.ConnectionError('down'))
        user = self._login(get)
        self.assertEqual(user.avatar_url, '')

    @override_settings(IMAGE_UPLOAD_MAX_SIZE=10)
    def test_oversized_avatar_is_skipped(self):
        user = self._login(_response())
        self.assertEqual(user.avatar_url, '')

    def test_non_image_body_is_skipped(self):
        user = self._login(_response(b'<html>not an image</html>'))
        self.assertEqual(user.avatar_url, '')

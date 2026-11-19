"""Quyền tải asset CV (`readable_asset`) và ẩn asset (`CvAsset.deactivate`)."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import TestCase

from ..models import CvAsset
from ..services import readable_asset
from ..services.assets import sign_asset


def make_asset(kind, owner=None, **overrides):
    return CvAsset.objects.create(
        owner=owner,
        kind=kind,
        storage_key=f'cvs/{kind}.png',
        content_type='image/png',
        size_bytes=10,
        width=1,
        height=1,
        checksum_sha256='0' * 64,
        **overrides,
    )


class ReadableAssetTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.owner = users.create_user(email='asset-owner@example.com', role='candidate')
        self.other = users.create_user(email='asset-other@example.com', role='candidate')
        self.avatar = make_asset(CvAsset.Kind.AVATAR, owner=self.owner)
        self.background = make_asset(CvAsset.Kind.BACKGROUND)

    def read(self, asset, user, token=None):
        return readable_asset(asset_public_id=asset.public_id, token=token, user=user)

    def test_background_is_public_and_avatar_only_reaches_its_owner(self):
        self.assertEqual(self.read(self.background, AnonymousUser()), self.background)
        self.assertEqual(self.read(self.avatar, self.owner), self.avatar)
        for user in (AnonymousUser(), self.other):
            with self.assertRaises(CvAsset.DoesNotExist):
                self.read(self.avatar, user)

    def test_inactive_asset_is_unavailable(self):
        self.background.deactivate()
        self.background.refresh_from_db()
        self.assertFalse(self.background.is_active)
        with self.assertRaises(CvAsset.DoesNotExist):
            self.read(self.background, AnonymousUser())

    def test_signed_token_must_match_the_asset_and_a_known_audience(self):
        token = sign_asset(self.avatar)
        self.assertEqual(self.read(self.avatar, AnonymousUser(), token), self.avatar)
        with self.assertRaises(CvAsset.DoesNotExist):
            self.read(self.background, AnonymousUser(), token)
        foreign = sign_asset(self.avatar, audience='someone_else', subject='x', resource='y')
        with self.assertRaises(CvAsset.DoesNotExist):
            self.read(self.avatar, self.owner, foreign)

    def test_recruiter_token_requires_the_signed_employer(self):
        token = sign_asset(
            self.avatar,
            audience='recruiter_application',
            subject='usr_someone',
            resource='app_x',
        )
        with self.assertRaises(CvAsset.DoesNotExist):
            self.read(self.avatar, self.other, token)

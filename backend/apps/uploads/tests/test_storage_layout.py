from pathlib import Path
from tempfile import TemporaryDirectory

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.http import Http404
from django.test import RequestFactory, SimpleTestCase, override_settings
from django.views.static import serve

from common.storage.private import (
    PrivateFileSystemStorage,
    PrivateS3Storage,
    PrivateStorageUrlError,
    QuarantineFileSystemStorage,
    QuarantineS3Storage,
    storage_boundary_configuration_errors,
)


def _local_storages(public_root, private_root, quarantine_root):
    return {
        'default': {
            'BACKEND': 'common.storage.private.PrivateFileSystemStorage',
            'OPTIONS': {'location': private_root, 'base_url': None},
        },
        'private_media': {
            'BACKEND': 'common.storage.private.PrivateFileSystemStorage',
            'OPTIONS': {'location': private_root, 'base_url': None},
        },
        'quarantine': {
            'BACKEND': 'common.storage.private.QuarantineFileSystemStorage',
            'OPTIONS': {'location': quarantine_root, 'base_url': None},
        },
        'public_media': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
            'OPTIONS': {'location': public_root, 'base_url': '/media/'},
        },
        'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    }


class ProtectedStorageBackendTests(SimpleTestCase):
    def test_active_local_roots_are_distinct_and_default_is_private(self):
        roots = {
            Path(settings.PUBLIC_MEDIA_ROOT).resolve(strict=False),
            Path(settings.PRIVATE_MEDIA_ROOT).resolve(strict=False),
            Path(settings.UPLOAD_QUARANTINE_ROOT).resolve(strict=False),
        }

        self.assertEqual(len(roots), 3)
        self.assertIsInstance(storages['default'], PrivateFileSystemStorage)
        self.assertIsInstance(storages['private_media'], PrivateFileSystemStorage)
        with self.assertRaises(PrivateStorageUrlError):
            storages['default'].url('cvs/imports/candidate.docx')

    def test_local_private_and_quarantine_urls_fail_closed(self):
        private = PrivateFileSystemStorage(location='/tmp/private-storage-test')
        quarantine = QuarantineFileSystemStorage(location='/tmp/quarantine-storage-test')

        with self.assertRaises(PrivateStorageUrlError):
            private.url('cvs/imports/candidate.docx')
        with self.assertRaises(PrivateStorageUrlError):
            quarantine.url('pending/untrusted.docx')

    def test_r2_private_and_quarantine_urls_fail_before_signing(self):
        private = PrivateS3Storage(bucket_name='private-test')
        quarantine = QuarantineS3Storage(bucket_name='quarantine-test')

        with self.assertRaises(PrivateStorageUrlError):
            private.url('employers/documents/license.pdf')
        with self.assertRaises(PrivateStorageUrlError):
            quarantine.url('pending/untrusted.pdf')

    def test_partial_r2_quarantine_config_is_a_fail_fast_error(self):
        errors = storage_boundary_configuration_errors(
            public_root='/srv/public',
            private_root='/srv/private',
            quarantine_root='/srv/quarantine',
            r2_enabled=True,
            r2_quarantine_enabled=False,
            r2_buckets=('public', 'private', 'quarantine'),
        )

        self.assertTrue(any('không được fallback sang local' in error for error in errors))

    def test_nested_roots_and_reused_r2_buckets_are_errors(self):
        errors = storage_boundary_configuration_errors(
            public_root='/srv/media',
            private_root='/srv/media/private',
            quarantine_root='/srv/quarantine',
            r2_enabled=True,
            r2_quarantine_enabled=True,
            r2_buckets=('public', 'private', 'private'),
            r2_credential_pairs=(
                ('public-key', 'a'),
                ('private-key', 'b'),
                ('quarantine-key', 'c'),
            ),
        )

        self.assertEqual(len(errors), 2)

    def test_reused_r2_credentials_are_rejected_without_exposing_values(self):
        reused = ('shared-access-key', 'shared-secret')
        errors = storage_boundary_configuration_errors(
            public_root='/srv/public',
            private_root='/srv/private',
            quarantine_root='/srv/quarantine',
            r2_enabled=True,
            r2_quarantine_enabled=True,
            r2_buckets=('public', 'private', 'quarantine'),
            r2_credential_pairs=(reused, reused, ('quarantine-key', 'quarantine-secret')),
        )

        self.assertEqual(
            errors,
            ['R2 public/private/quarantine phải dùng ba credential pair khác nhau.'],
        )
        self.assertNotIn(reused[0], errors[0])
        self.assertNotIn(reused[1], errors[0])


class PublicMediaRouteTests(SimpleTestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        root = Path(self.temporary.name)
        self.public_root = root / 'public'
        private_root = root / 'private'
        quarantine_root = root / 'quarantine'
        self.override = override_settings(
            PUBLIC_MEDIA_ROOT=self.public_root,
            MEDIA_ROOT=self.public_root,
            PRIVATE_MEDIA_ROOT=private_root,
            UPLOAD_QUARANTINE_ROOT=quarantine_root,
            STORAGES=_local_storages(self.public_root, private_root, quarantine_root),
        )
        self.override.enable()

    def tearDown(self):
        self.override.disable()
        self.temporary.cleanup()

    def test_private_keys_cannot_be_read_through_public_media_route(self):
        keys = (
            'employers/company_1/documents/license.pdf',
            'cvs/imports/user_1/resume.docx',
        )
        for key in keys:
            storages['private_media'].save(key, ContentFile(b'sensitive'))

        for key in keys:
            with self.subTest(key=key), self.assertRaises(Http404):
                serve(
                    RequestFactory().get(f'/media/{key}'),
                    key,
                    document_root=self.public_root,
                )

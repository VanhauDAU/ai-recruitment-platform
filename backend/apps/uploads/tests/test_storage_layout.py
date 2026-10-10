import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.core.management import call_command
from django.core.management.base import CommandError
from django.http import Http404
from django.test import RequestFactory, SimpleTestCase, override_settings
from django.views.static import serve

from apps.uploads.services import classify_legacy_storage_key
from common.private_storage import (
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
            'BACKEND': 'common.private_storage.PrivateFileSystemStorage',
            'OPTIONS': {'location': private_root, 'base_url': None},
        },
        'private_media': {
            'BACKEND': 'common.private_storage.PrivateFileSystemStorage',
            'OPTIONS': {'location': private_root, 'base_url': None},
        },
        'quarantine': {
            'BACKEND': 'common.private_storage.QuarantineFileSystemStorage',
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

    def test_legacy_root_must_not_overlap_an_active_root(self):
        errors = storage_boundary_configuration_errors(
            public_root='/srv/public',
            private_root='/srv/private',
            quarantine_root='/srv/quarantine',
            legacy_root='/srv/public/legacy',
            r2_enabled=False,
            r2_quarantine_enabled=False,
            r2_buckets=('public', 'private', 'quarantine'),
        )

        self.assertEqual(
            errors,
            ['LEGACY_MEDIA_ROOT và PUBLIC_MEDIA_ROOT phải tách biệt, không lồng nhau.'],
        )


class StorageLayoutClassificationTests(SimpleTestCase):
    def test_only_explicit_public_allowlist_is_public(self):
        public_keys = (
            'employers/company_1/gallerys/photo.png',
            'employers/company_1/gallery/photo.png',
            'knowledgebase/content/guide.png',
            'frontend/legacy/onboarding/step.png',
            'migrations/external-media/blog/post/1/thumbnail/image.png',
        )
        for key in public_keys:
            with self.subTest(key=key):
                self.assertEqual(classify_legacy_storage_key(key), 'public')
        self.assertEqual(
            classify_legacy_storage_key('employers/company_1/documents/license.pdf'),
            'private',
        )
        self.assertEqual(
            classify_legacy_storage_key('cvs/imports/user_1/resume.docx'),
            'private',
        )

    def test_invalid_key_is_rejected_instead_of_normalised(self):
        for key in ('', '/absolute.pdf', '../escape.pdf', 'nested/../escape.pdf', 'bad\\key'):
            with self.subTest(key=key), self.assertRaises(ValueError):
                classify_legacy_storage_key(key)


class StorageLayoutMigrationCommandTests(SimpleTestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        root = Path(self.temporary.name)
        self.legacy_root = root / 'legacy'
        self.public_root = root / 'public'
        self.private_root = root / 'private'
        self.quarantine_root = root / 'quarantine'
        self.legacy_root.mkdir()
        self.override = override_settings(
            LEGACY_MEDIA_ROOT=self.legacy_root,
            PUBLIC_MEDIA_ROOT=self.public_root,
            MEDIA_ROOT=self.public_root,
            PRIVATE_MEDIA_ROOT=self.private_root,
            UPLOAD_QUARANTINE_ROOT=self.quarantine_root,
            STORAGES=_local_storages(
                self.public_root,
                self.private_root,
                self.quarantine_root,
            ),
        )
        self.override.enable()

    def tearDown(self):
        self.override.disable()
        self.temporary.cleanup()

    def _write_legacy(self, key, payload):
        path = self.legacy_root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)

    def _run_json(self, *args):
        output = StringIO()
        call_command('migrate_media_storage_layout', *args, '--json', stdout=output)
        return json.loads(output.getvalue())

    def test_dry_run_is_batched_cursor_resumable_and_read_only(self):
        self._write_legacy('cvs/imports/candidate.pdf', b'candidate')
        self._write_legacy('site/settings/logo.png', b'logo')

        first = self._run_json('--batch-size=1')

        self.assertEqual(first['counts']['inspected'], 1)
        self.assertTrue(first['has_more'])
        self.assertTrue(first['source_retained'])
        self.assertEqual(first['findings'][0]['action'], 'would_copy')
        self.assertFalse(self.public_root.exists())
        self.assertFalse(self.private_root.exists())

        second = self._run_json('--batch-size=1', f'--cursor={first["next_cursor"]}')
        self.assertEqual(second['counts']['inspected'], 1)
        self.assertFalse(second['has_more'])
        self.assertNotEqual(second['next_cursor'], first['next_cursor'])

    def test_apply_copies_and_verifies_both_boundaries_without_deleting_legacy(self):
        private_key = 'employers/company_1/documents/license.pdf'
        public_key = 'employers/company_1/gallerys/photo.png'
        self._write_legacy(private_key, b'private-document')
        self._write_legacy(public_key, b'public-image')

        report = self._run_json('--apply')

        self.assertEqual(report['counts']['copied'], 2)
        self.assertTrue((self.legacy_root / private_key).exists())
        self.assertTrue((self.legacy_root / public_key).exists())
        self.assertEqual(storages['private_media'].open(private_key).read(), b'private-document')
        self.assertEqual(storages['public_media'].open(public_key).read(), b'public-image')

        repeated = self._run_json('--apply')
        self.assertEqual(repeated['counts']['already_copied'], 2)
        self.assertEqual(repeated['counts']['copied'], 0)

    def test_target_mismatch_fails_closed_and_retains_source(self):
        key = 'cvs/imports/candidate.pdf'
        self._write_legacy(key, b'expected')
        storages['private_media'].save(key, ContentFile(b'different'))
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command(
                'migrate_media_storage_layout',
                '--apply',
                '--json',
                stdout=output,
            )

        report = json.loads(output.getvalue())
        self.assertEqual(report['counts']['conflicts'], 1)
        self.assertTrue((self.legacy_root / key).exists())
        self.assertEqual(storages['private_media'].open(key).read(), b'different')

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

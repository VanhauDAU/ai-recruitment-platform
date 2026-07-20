"""Copy legacy filesystem media to its public or private Cloudflare R2 bucket."""

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from common.r2_storage import private_media_storage, public_media_storage


PUBLIC_PREFIXES = (
    'site/',
    'blog/',
    'jobs/',
    'cv-templates/',
    'cvs/backgrounds/',
    # Profile avatars have historically been public profile media; changing
    # their access policy requires a product-level viewer/consent workflow.
    'users/avatars/',
)
PUBLIC_EMPLOYER_SEGMENTS = ('/logos/', '/covers/', '/gallery/')


def is_public_key(key: str) -> bool:
    return key.startswith(PUBLIC_PREFIXES) or (
        key.startswith('employers/') and any(segment in key for segment in PUBLIC_EMPLOYER_SEGMENTS)
    )


class Command(BaseCommand):
    help = 'Dry-run or copy legacy backend/media files to their Cloudflare R2 bucket without deleting local files.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Copy missing objects to R2.')

    def handle(self, *args, **options):
        public_storage = public_media_storage()
        private_storage = private_media_storage()
        if public_storage.__class__.__module__.startswith('django.core.files.storage'):
            raise CommandError('R2 is not configured. Set all R2_* variables in the local backend .env first.')

        root = Path(settings.MEDIA_ROOT)
        if not root.exists():
            self.stdout.write(self.style.WARNING('No local media directory exists.'))
            return

        total = public_count = private_count = copied = missing = 0
        for path in sorted(item for item in root.rglob('*') if item.is_file()):
            key = path.relative_to(root).as_posix()
            storage = public_storage if is_public_key(key) else private_storage
            is_public = storage is public_storage
            total += 1
            public_count += int(is_public)
            private_count += int(not is_public)
            object_missing = not storage.exists(key)
            missing += int(object_missing)
            if options['apply'] and object_missing:
                with path.open('rb') as stream:
                    storage.save(key, File(stream, name=path.name))
                copied += 1

        mode = 'Applied' if options['apply'] else 'Dry run'
        self.stdout.write(self.style.SUCCESS(
            f'{mode}: {total} local objects ({public_count} public, {private_count} private); '
            f'{missing} missing before copy, {copied} newly copied. '
            'Local files were retained.',
        ))

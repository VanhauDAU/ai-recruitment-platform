"""Audit and copy legacy shared media into isolated storage boundaries."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from common.r2_storage import private_media_storage, public_media_storage

from ...services import classify_legacy_storage_key

READ_CHUNK_SIZE = 1024 * 1024


def _roots_overlap(first: Path, second: Path) -> bool:
    return first == second or first in second.parents or second in first.parents


def _stream_digest(stream) -> str:
    digest = hashlib.sha256()
    while chunk := stream.read(READ_CHUNK_SIZE):
        digest.update(chunk)
    return digest.hexdigest()


def _source_digest(path: Path) -> str:
    with path.open('rb') as stream:
        return _stream_digest(stream)


def _storage_digest(storage, key: str) -> str:
    with storage.open(key, 'rb') as stream:
        return _stream_digest(stream)


class Command(BaseCommand):
    help = (
        'Audit the unserved legacy media root and, with --apply, copy objects '
        'into public or private storage. Legacy source bytes are always retained.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Copy and verify missing objects; never remove legacy source bytes.',
        )
        parser.add_argument(
            '--cursor',
            default='',
            help='Resume after this relative storage key (exclusive).',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=500,
            help='Maximum objects to inspect in this invocation (1..10000).',
        )
        parser.add_argument('--json', action='store_true', dest='as_json')

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        if not 1 <= batch_size <= 10_000:
            raise CommandError('--batch-size must be between 1 and 10000.')

        cursor = options['cursor'].strip()
        if cursor:
            try:
                classify_legacy_storage_key(cursor)
            except ValueError as error:
                raise CommandError(f'Invalid --cursor: {error}') from error

        legacy_root = Path(settings.LEGACY_MEDIA_ROOT).resolve(strict=False)
        public_root = Path(settings.PUBLIC_MEDIA_ROOT).resolve(strict=False)
        private_root = Path(settings.PRIVATE_MEDIA_ROOT).resolve(strict=False)
        quarantine_root = Path(settings.UPLOAD_QUARANTINE_ROOT).resolve(strict=False)
        isolated_roots = (public_root, private_root, quarantine_root)
        if any(
            _roots_overlap(first, second)
            for index, first in enumerate(isolated_roots)
            for second in isolated_roots[index + 1 :]
        ):
            raise CommandError(
                'Public, private, and quarantine roots must be distinct and non-nested.'
            )
        if any(_roots_overlap(legacy_root, target) for target in isolated_roots):
            raise CommandError('LEGACY_MEDIA_ROOT must be distinct from every active storage root.')

        candidates = self._candidate_batch(legacy_root, cursor, batch_size)
        has_more = len(candidates) > batch_size
        batch = candidates[:batch_size]
        storages = {'public': public_media_storage(), 'private': private_media_storage()}
        counts = {
            'inspected': 0,
            'public': 0,
            'private': 0,
            'copied': 0,
            'already_copied': 0,
            'conflicts': 0,
        }
        findings = []

        for key, source_path in batch:
            counts['inspected'] += 1
            if source_path.is_symlink():
                counts['conflicts'] += 1
                findings.append({'key': key, 'class': 'unknown', 'action': 'blocked_symlink'})
                continue

            storage_class = classify_legacy_storage_key(key)
            counts[storage_class] += 1
            action = 'would_copy'
            if options['apply']:
                action = self._copy_verified(source_path, key, storages[storage_class])
                if action == 'copied':
                    counts['copied'] += 1
                elif action == 'already_copied':
                    counts['already_copied'] += 1
                else:
                    counts['conflicts'] += 1
            findings.append({'key': key, 'class': storage_class, 'action': action})

        report = {
            'version': 1,
            'mode': 'apply' if options['apply'] else 'dry-run',
            'cursor': cursor,
            'next_cursor': batch[-1][0] if batch else '',
            'has_more': has_more,
            'source_retained': True,
            'counts': counts,
            'findings': findings,
        }
        self._write_report(report, options['as_json'])
        if counts['conflicts']:
            raise CommandError(
                f'{counts["conflicts"]} object(s) were not copied; legacy source bytes were retained.'
            )

    @staticmethod
    def _candidate_batch(root, cursor, batch_size):
        if not root.exists():
            return []
        candidates = []
        for path in root.rglob('*'):
            if path.is_file() or path.is_symlink():
                key = path.relative_to(root).as_posix()
                if key > cursor:
                    candidates.append((key, path))
        candidates.sort(key=lambda item: item[0])
        return candidates[: batch_size + 1]

    @staticmethod
    def _copy_verified(source_path, key, storage):
        source_digest = _source_digest(source_path)
        if storage.exists(key):
            if _storage_digest(storage, key) == source_digest:
                return 'already_copied'
            return 'blocked_target_mismatch'

        with source_path.open('rb') as stream:
            saved_key = storage.save(key, File(stream, name=source_path.name))
        if saved_key != key:
            storage.delete(saved_key)
            return 'blocked_target_collision'
        if _storage_digest(storage, key) != source_digest:
            storage.delete(key)
            return 'blocked_verification_mismatch'
        return 'copied'

    def _write_report(self, report, as_json):
        if as_json:
            self.stdout.write(json.dumps(report, ensure_ascii=False, sort_keys=True))
            return
        counts = report['counts']
        self.stdout.write(
            f'{report["mode"]}: inspected={counts["inspected"]} '
            f'public={counts["public"]} private={counts["private"]} '
            f'copied={counts["copied"]} conflicts={counts["conflicts"]} '
            f'next_cursor={report["next_cursor"]!r} has_more={report["has_more"]}; '
            'legacy source retained'
        )

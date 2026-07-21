"""Copy the finite set of legacy TopCV UI images to the public R2 bucket."""

from __future__ import annotations

from hashlib import sha256
from pathlib import PurePosixPath

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from common.r2_storage import public_media_storage

LEGACY_ASSETS = {
    'frontend/legacy/onboarding/bg-step-1.png': 'https://static.topcv.vn/v4/image/onboard-user/bg-step-1.png',
    'frontend/legacy/icons/shield-check.png': 'https://static.topcv.vn/v4/image/icon/icon-shield-check.png',
    'frontend/legacy/icons/shield-gears.png': 'https://static.topcv.vn/v4/image/icon/icon-shield-gears.png',
    'frontend/legacy/welcome/section-header-before.png': 'https://static.topcv.vn/v4/image/welcome/section-header/section_header_before_bg.png',
    'frontend/legacy/welcome/section-header-after.png': 'https://static.topcv.vn/v4/image/welcome/section-header/section_header_after_bg.png',
    'frontend/legacy/cv-template/toppy-list-mau-cv.png': 'https://www.topcv.vn/v4/image/cv-template/cv-sample/toppy-list-mau-cv.png',
    'frontend/legacy/cv-builder/bg-5.png': 'https://www.topcv.vn/v4/image/cv_builder/background/bg_5.png',
    'frontend/legacy/blog/blog-banner-toppy-3d.png': 'https://static.topcv.vn/v4/image/blog/blog-banner-toppy-3d.png',
    'frontend/legacy/blog/search-tool-v2.png': 'https://static.topcv.vn/v4/image/blog/blog-detail/search_tool_v2.png',
    'frontend/legacy/blog/cv-tool-v2.png': 'https://static.topcv.vn/v4/image/blog/blog-detail/cv_tool_v2.png',
    'frontend/legacy/blog/survey-tool-v2.png': 'https://static.topcv.vn/v4/image/blog/blog-detail/survey_tool_v2.png',
    'frontend/legacy/home/hotline-bg.png': 'https://static.topcv.vn/v4/image/job-new/hotline_bg.png',
    'frontend/legacy/welcome/dashboard-item.png': 'https://static.topcv.vn/v4/image/welcome/dashboard/dashboard-item.png',
    'frontend/legacy/welcome/flash-badge-cover.png': 'https://static.topcv.vn/v4/image/welcome/box-flash-badge/cover.png',
    'frontend/legacy/welcome/flash-badge-intro.png': 'https://static.topcv.vn/v4/image/welcome/box-flash-badge/flash-badge-intro.png',
}
MAX_ASSET_BYTES = 10 * 1024 * 1024


def _download(url):
    response = requests.get(url, timeout=(5, 30), stream=True, allow_redirects=False)
    response.raise_for_status()
    content_type = response.headers.get('Content-Type', '').split(';', 1)[0].lower()
    if not content_type.startswith('image/'):
        raise ValueError(f'unexpected content type {content_type or "unknown"}')
    payload = bytearray()
    for chunk in response.iter_content(chunk_size=64 * 1024):
        payload.extend(chunk)
        if len(payload) > MAX_ASSET_BYTES:
            raise ValueError('asset exceeds 10 MB')
    return bytes(payload)


class Command(BaseCommand):
    help = 'Copy hard-coded legacy frontend image assets to Cloudflare R2 public media.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Upload missing assets. Without this flag only verify sources.',
        )

    def handle(self, *args, **options):
        storage = public_media_storage()
        if storage.__class__.__module__.startswith('django.core.files.storage'):
            raise CommandError(
                'R2 is not configured. Set all R2_* variables in the local backend .env first.'
            )

        copied = verified = failed = 0
        for key, source_url in LEGACY_ASSETS.items():
            try:
                payload = _download(source_url)
                digest = sha256(payload).hexdigest()
                if options['apply'] and not storage.exists(key):
                    storage.save(key, ContentFile(payload))
                    copied += 1
                verified += 1
                self.stdout.write(f'{PurePosixPath(key)} {digest[:12]}')
            except (requests.RequestException, ValueError) as error:
                failed += 1
                self.stderr.write(f'Failed {PurePosixPath(key)}: {error}')
        if failed:
            raise CommandError(f'{failed} frontend asset(s) could not be migrated.')
        mode = 'Applied' if options['apply'] else 'Verified'
        self.stdout.write(
            self.style.SUCCESS(f'{mode}: {verified} assets; {copied} newly uploaded.')
        )

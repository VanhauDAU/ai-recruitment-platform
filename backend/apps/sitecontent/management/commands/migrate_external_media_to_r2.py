"""Copy structured public image URLs into the configured public R2 bucket.

This command intentionally only changes fields that are presentation media.
CVs, exports, avatars and verification documents are private by policy and
must be moved through a separately authorized backfill, never by downloading
arbitrary URLs from database fields.
"""

from __future__ import annotations

from hashlib import sha256
from io import BytesIO
from pathlib import PurePosixPath
from urllib.parse import urlparse

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from PIL import Image

from apps.accounts.models import User
from apps.blog.models import Post
from apps.cv_templates.models import CvTemplate, CvTemplateColorLink
from apps.employers.models import Company, CompanyImage
from apps.jobs.models import JobCategory
from apps.sitecontent.models import Banner, SiteSetting
from common.r2_storage import public_media_storage

PUBLIC_IMAGE_FIELDS = (
    (User, 'avatar_url'),
    (Company, 'logo_url'),
    (Company, 'cover_image_url'),
    (CompanyImage, 'image_url'),
    (JobCategory, 'logo_url'),
    (Banner, 'image_url'),
    (SiteSetting, 'value'),
    (Post, 'thumbnail_url'),
    (CvTemplate, 'thumbnail_url'),
    (CvTemplate, 'preview_url'),
    (CvTemplateColorLink, 'thumbnail_url'),
    (CvTemplateColorLink, 'preview_url'),
)
MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024
IMAGE_EXTENSIONS = {
    'JPEG': 'jpg',
    'PNG': 'png',
    'GIF': 'gif',
    'WEBP': 'webp',
}


def _is_external_http_url(value):
    if not isinstance(value, str):
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme in {'http', 'https'} and bool(parsed.netloc)


def _image_payload(url):
    response = requests.get(url, stream=True, timeout=(5, 30), allow_redirects=True)
    response.raise_for_status()
    payload = bytearray()
    for chunk in response.iter_content(chunk_size=64 * 1024):
        payload.extend(chunk)
        if len(payload) > MAX_DOWNLOAD_BYTES:
            raise ValueError('image exceeds 10 MB')
    try:
        image = Image.open(BytesIO(payload))
        image.verify()
        image_format = image.format
    except (OSError, ValueError) as error:
        raise ValueError('not a supported raster image') from error
    extension = IMAGE_EXTENSIONS.get(image_format)
    if extension is None:
        raise ValueError(f'unsupported image format: {image_format or "unknown"}')
    return bytes(payload), extension


class Command(BaseCommand):
    help = 'Dry-run or copy external public image URLs into Cloudflare R2 and replace them with storage keys.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply', action='store_true', help='Write objects and update database values.'
        )
        parser.add_argument(
            '--limit', type=int, default=0, help='Process at most this many matching values.'
        )

    def handle(self, *args, **options):
        storage = public_media_storage()
        if storage.__class__.__module__.startswith('django.core.files.storage'):
            raise CommandError(
                'R2 is not configured. Set all R2_* variables in the local backend .env first.'
            )

        apply = options['apply']
        limit = max(options['limit'], 0)
        inspected = migrated = failed = 0
        for model, field in PUBLIC_IMAGE_FIELDS:
            queryset = model.objects.all().only('pk', field)
            if model is SiteSetting:
                queryset = queryset.filter(value_type=SiteSetting.ValueType.IMAGE)
            for instance in queryset.iterator():
                value = getattr(instance, field)
                if not _is_external_http_url(value):
                    continue
                inspected += 1
                if limit and inspected > limit:
                    break
                try:
                    payload, extension = _image_payload(value)
                    digest = sha256(payload).hexdigest()
                    key = PurePosixPath(
                        'migrations',
                        'external-media',
                        model._meta.app_label,
                        model._meta.model_name,
                        str(instance.pk),
                        field,
                        f'{digest}.{extension}',
                    ).as_posix()
                    if apply and not storage.exists(key):
                        storage.save(key, ContentFile(payload))
                    if apply:
                        setattr(instance, field, key)
                        instance.save(
                            update_fields=[field, 'updated_at']
                            if hasattr(instance, 'updated_at')
                            else [field]
                        )
                    migrated += 1
                except (requests.RequestException, ValueError) as error:
                    failed += 1
                    self.stderr.write(f'Skipped {model._meta.label}#{instance.pk}.{field}: {error}')
            if limit and inspected >= limit:
                break

        mode = 'Applied' if apply else 'Dry run'
        self.stdout.write(
            self.style.SUCCESS(
                f'{mode}: {inspected} external public image references; '
                f'{migrated} ready to migrate; {failed} skipped.'
            )
        )

"""Private owner-scoped thumbnail orchestration for saved CV versions."""

import logging

from django.core.files.storage import default_storage
from django.db import transaction

from ..models import CvVersion, UserCv

logger = logging.getLogger(__name__)
THUMBNAIL_RENDERER_REVISION = 'r6'


def thumbnail_key_for(cv, version):
    return (
        f'cvs/thumbnails/{cv.public_id}/'
        f'{version.public_id}-{version.content_hash[:12]}-{THUMBNAIL_RENDERER_REVISION}.webp'
    )


def current_thumbnail_ready(cv):
    version = cv.latest_version
    if version is None or not cv.thumbnail_url:
        return False
    return cv.thumbnail_url == thumbnail_key_for(cv, version) and default_storage.exists(
        cv.thumbnail_url
    )


def schedule_cv_thumbnail(version):
    """Enqueue after commit so the worker only reads a durable immutable version."""
    version_id = version.pk

    def dispatch():
        try:
            from ..tasks import generate_cv_thumbnail

            generate_cv_thumbnail.delay(version_id)
        except Exception:  # noqa: BLE001 - owner can request the idempotent job again
            logger.exception('Unable to enqueue CV thumbnail for version %s.', version_id)

    transaction.on_commit(dispatch)


def request_current_cv_thumbnail(*, cv, actor):
    if cv.user_id != actor.pk or cv.is_deleted:
        raise ValueError('This CV is unavailable.')
    current = UserCv.objects.select_related('latest_version').get(pk=cv.pk)
    if current.latest_version is None:
        raise CvVersion.DoesNotExist('This CV has no saved version.')
    if not current_thumbnail_ready(current):
        schedule_cv_thumbnail(current.latest_version)
    return current

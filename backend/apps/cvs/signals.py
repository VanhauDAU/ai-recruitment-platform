"""Storage cleanup tied to the lifetime of CV rows."""

from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from common.r2_storage import private_media_storage

from .models import CvVersion


@receiver(post_delete, sender=CvVersion)
def delete_snapshot_source_file(sender, instance, **kwargs):
    """An application snapshot owns its copy of the uploaded file; drop it with the row."""
    key = instance.source_file_key
    if key:
        transaction.on_commit(lambda: private_media_storage().delete(key))

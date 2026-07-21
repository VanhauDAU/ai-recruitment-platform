"""Explicit storage selection for Cloudflare R2 media.

Public objects may be returned as their R2 public URL.  Private objects are
never serialized as object-store URLs; the application reads them only after
the owning endpoint has performed its authorization checks.
"""

from django.core.files.storage import default_storage, storages


def public_media_storage():
    """Storage for intentionally public, non-sensitive presentation media."""
    return storages['public_media']


def private_media_storage():
    """Storage for CVs, exports, identity documents and candidate assets."""
    return default_storage


def cv_asset_storage(asset):
    """CV backgrounds are catalogue assets; candidate avatars remain private."""
    from apps.cvs.models import CvAsset

    return (
        public_media_storage() if asset.kind == CvAsset.Kind.BACKGROUND else private_media_storage()
    )

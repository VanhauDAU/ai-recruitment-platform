"""Explicit storage selection for Cloudflare R2 media.

Public objects may be returned as their R2 public URL.  Private objects are
never serialized as object-store URLs; the application reads them only after
the owning endpoint has performed its authorization checks.
"""

from django.core.files.storage import storages


def public_media_storage():
    """Storage for intentionally public, non-sensitive presentation media."""
    return storages['public_media']


def private_media_storage():
    """Storage for CVs, exports, identity documents and candidate assets."""
    return storages['private_media']


def quarantine_storage():
    """Storage for untrusted uploads that have not passed malware scanning."""
    return storages['quarantine']

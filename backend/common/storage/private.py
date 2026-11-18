"""Protected storage backends that never expose direct object URLs."""

from pathlib import Path

from django.core.exceptions import SuspiciousOperation
from django.core.files.storage import FileSystemStorage
from storages.backends.s3 import S3Storage


class PrivateStorageUrlError(SuspiciousOperation):
    """Raised when code tries to create a direct URL for a protected object."""


class _DenyDirectUrlMixin:
    storage_label = 'private'

    def url(self, name, *args, **kwargs):
        del name, args, kwargs
        raise PrivateStorageUrlError(
            f'{self.storage_label.capitalize()} storage does not expose direct URLs.'
        )


class PrivateFileSystemStorage(_DenyDirectUrlMixin, FileSystemStorage):
    """Local filesystem storage with an application-only read boundary."""


class QuarantineFileSystemStorage(PrivateFileSystemStorage):
    """Local storage for untrusted bytes awaiting a scanner decision."""

    storage_label = 'quarantine'


class PrivateS3Storage(_DenyDirectUrlMixin, S3Storage):
    """S3-compatible private storage without signed or unsigned URL escape."""


class QuarantineS3Storage(PrivateS3Storage):
    """S3-compatible quarantine storage isolated by bucket and credentials."""

    storage_label = 'quarantine'


def storage_boundary_configuration_errors(
    *,
    public_root,
    private_root,
    quarantine_root,
    r2_enabled,
    r2_quarantine_enabled,
    r2_buckets,
    r2_credential_pairs=(),
    legacy_root=None,
):
    """Return boundary errors for deployment validation and tests."""
    roots = {
        'PUBLIC_MEDIA_ROOT': Path(public_root).resolve(strict=False),
        'PRIVATE_MEDIA_ROOT': Path(private_root).resolve(strict=False),
        'UPLOAD_QUARANTINE_ROOT': Path(quarantine_root).resolve(strict=False),
    }
    errors = []
    names = tuple(roots)
    for index, first_name in enumerate(names):
        first = roots[first_name]
        for second_name in names[index + 1 :]:
            second = roots[second_name]
            if first == second or first in second.parents or second in first.parents:
                errors.append(f'{first_name} và {second_name} phải tách biệt, không lồng nhau.')

    if legacy_root is not None:
        legacy = Path(legacy_root).resolve(strict=False)
        for active_name, active_root in roots.items():
            if (
                legacy == active_root
                or legacy in active_root.parents
                or active_root in legacy.parents
            ):
                errors.append(
                    f'LEGACY_MEDIA_ROOT và {active_name} phải tách biệt, không lồng nhau.'
                )

    buckets = tuple(r2_buckets)
    if r2_enabled and not r2_quarantine_enabled:
        errors.append(
            'R2 public/private đã bật nhưng credential/bucket quarantine chưa đầy đủ; '
            'không được fallback sang local.'
        )
    if r2_enabled and len(set(buckets)) != len(buckets):
        errors.append('R2 public/private/quarantine phải dùng ba bucket khác nhau.')
    credentials = tuple(r2_credential_pairs)
    if r2_enabled and credentials and len(set(credentials)) != len(credentials):
        errors.append('R2 public/private/quarantine phải dùng ba credential pair khác nhau.')
    return errors

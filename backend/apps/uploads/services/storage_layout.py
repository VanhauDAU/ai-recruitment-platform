"""Canonical fail-closed classification for legacy media storage keys."""

from pathlib import PurePosixPath

PUBLIC_PREFIXES = (
    'site/',
    'blog/',
    'jobs/',
    'knowledgebase/content/',
    'cv-templates/',
    'cvs/backgrounds/',
    'frontend/legacy/',
    'migrations/external-media/',
    # Historical product policy; changing avatar visibility is a separate flow.
    'users/avatars/',
)
PUBLIC_EMPLOYER_DIRECTORIES = frozenset({'logos', 'covers', 'gallery', 'gallerys'})


def _normalise_key(key: str) -> str:
    if not isinstance(key, str) or not key or key.startswith('/') or '\\' in key:
        raise ValueError('Storage key must be a non-empty relative POSIX path.')
    path = PurePosixPath(key)
    if path.is_absolute() or '..' in path.parts or str(path) in {'', '.'}:
        raise ValueError('Storage key must not contain traversal segments.')
    return path.as_posix()


def classify_legacy_storage_key(key: str) -> str:
    """Return public only for an explicit allowlist; unknown keys are private."""
    normalised = _normalise_key(key)
    if normalised.startswith(PUBLIC_PREFIXES):
        return 'public'

    parts = PurePosixPath(normalised).parts
    if len(parts) >= 3 and parts[0] == 'employers' and parts[2] in PUBLIC_EMPLOYER_DIRECTORIES:
        return 'public'
    return 'private'

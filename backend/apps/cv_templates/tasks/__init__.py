"""Celery tasks sinh ảnh catalogue, nội dung mẫu và PDF thử của mẫu CV."""

from .template_assets import (
    SNAPSHOT_AVATAR_ID,
    SNAPSHOT_AVATAR_URI,
    SNAPSHOT_RENDERER_VERSION,
    STALE_SNAPSHOT_GRACE_SECONDS,
    delete_stale_snapshot,
    enqueue_template_snapshots,
    generate_cv_sample_content,
    generate_template_color_snapshot,
    regenerate_all_template_snapshots,
    render_template_test_pdf,
    snapshot_fingerprint,
)

__all__ = [
    'SNAPSHOT_AVATAR_ID',
    'SNAPSHOT_AVATAR_URI',
    'SNAPSHOT_RENDERER_VERSION',
    'STALE_SNAPSHOT_GRACE_SECONDS',
    'delete_stale_snapshot',
    'enqueue_template_snapshots',
    'generate_cv_sample_content',
    'generate_template_color_snapshot',
    'regenerate_all_template_snapshots',
    'render_template_test_pdf',
    'snapshot_fingerprint',
]

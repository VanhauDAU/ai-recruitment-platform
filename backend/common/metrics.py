"""Small PII-free product metric boundary for logs/collector ingestion."""

import logging

logger = logging.getLogger('product.metrics')
ALLOWED_METRICS = {
    'cv_preview_latency_ms',
    'cv_preview_cache_hit',
    'cv_autosave_conflict',
    'cv_import_duration_ms',
    'cv_import_failure',
    'cv_snapshot_duration_ms',
    'cv_snapshot_failure',
    'job_engagement',
    'job_impression_batch_size',
    'campaign_job_performance_duration_ms',
}


def record_metric(name, value=1, **tags):
    if name not in ALLOWED_METRICS:
        raise ValueError('Unregistered product metric.')
    safe_tags = {
        key: str(tag)[:80]
        for key, tag in tags.items()
        if key
        in {
            'source',
            'locale',
            'cache',
            'status',
            'failure_code',
            'event',
            'reason',
        }
    }
    logger.info(
        'product_metric',
        extra={
            'metric_name': name,
            'metric_value': value,
            'metric_tags': safe_tags,
        },
    )

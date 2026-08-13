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
    'job_promotion_alert',
    'saved_job_remarketing',
    'campaign_job_performance_duration_ms',
    'announcement_analytics',
    'announcement_event_batch_size',
    'announcement_feed_latency_ms',
    'announcement_runtime',
    'announcement_throttle',
    'knowledgebase_public_request',
    'knowledgebase_public_latency_ms',
    'knowledgebase_admin_request',
    'knowledgebase_admin_latency_ms',
    'knowledgebase_content_state',
    'upload_scan_duration_ms',
    'upload_scan_result',
    'upload_scanner_readiness',
    'upload_session_state',
    'employer_sms_dispatch',
    'employer_sms_recovery',
    'employer_sms_retention',
    'employer_notification_event',
    'employer_notification_retention',
    'candidate_job_digest',
    'ai_generation_request',
    'ai_generation_completion',
    'ai_generation_latency_ms',
    'ai_generation_queue_delay_ms',
    'ai_generation_provider_call',
    'ai_generation_tokens',
    'ai_generation_cost_microusd',
    'ai_generation_quota_rejection',
    'ai_generation_apply',
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
            'scope',
            'surface',
            'endpoint',
            'category',
            'article_type',
            'query_length_bucket',
            'result_bucket',
            'state',
            'purpose',
            'provider',
            'use_case',
            'model',
            'phase',
            'attempt',
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

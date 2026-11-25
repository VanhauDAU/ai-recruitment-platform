"""Cache Redis, Celery (queue, giới hạn, lịch beat) và thời hạn lưu sự kiện."""

from config.env import config

from .core import TIME_ZONE

# Redis cache — lưu token xác thực email + cooldown gửi lại (tự hết hạn theo TTL)
REDIS_URL = config('REDIS_URL', default='redis://127.0.0.1:6379/1')
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
    }
}

# Channel layer của WebSocket thông báo: web, worker và beat cùng đẩy sự kiện vào
# Redis, process `realtime` (daphne) chuyển tới socket đang mở. Prefix riêng để
# không đụng key cache/Celery.
# redis-py 8 mặc định chờ đọc 5 giây, bằng đúng thời gian channels_redis chặn ở
# BZPOPMIN (`brpop_timeout = 5`), nên mỗi socket rảnh sẽ lỗi TimeoutError và bị
# ngắt sau ~5 giây. Thời gian chờ đọc phải dài hơn khoảng chặn đó.
CHANNEL_LAYER_SOCKET_TIMEOUT = 15
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [
                {
                    # Để trống = dùng chung REDIS_URL.
                    'address': config('CHANNEL_LAYER_REDIS_URL', default='') or REDIS_URL,
                    'socket_timeout': CHANNEL_LAYER_SOCKET_TIMEOUT,
                }
            ],
            'prefix': 'procv-realtime',
            'capacity': 200,
            'expiry': 30,
        },
    }
}

# Celery dùng cùng Redis nhưng queue riêng cho email auth. Chạy worker và beat
# tách process khỏi web server để SMTP không làm chậm request đăng ký/login.
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default=REDIS_URL)
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default=None)
CELERY_TASK_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_DEFAULT_QUEUE = 'default'
CELERY_TASK_ROUTES = {
    'apps.accounts.tasks.auth_email.*': {'queue': 'auth-email'},
    'apps.employers.tasks.phone_sms.*': {'queue': 'auth-sms'},
    'apps.employers.tasks.tax_lookup.*': {'queue': 'default'},
    'apps.employers.tasks.domain_claims.*': {'queue': 'default'},
    'apps.campaigns.tasks.*': {'queue': 'default'},
    'apps.cv_templates.tasks.template_assets.generate_cv_sample_content': {
        'queue': 'ai-generation'
    },
    'apps.cv_templates.tasks.template_assets.render_template_test_pdf': {'queue': 'cv-export'},
    'apps.cvs.tasks.*': {'queue': 'cv-export'},
    'apps.uploads.tasks.*': {'queue': 'upload-scan'},
    'apps.jobs.tasks.ai_generation.*': {'queue': 'ai-generation'},
    # Chấm hồ sơ ứng tuyển chạy nền, tách khỏi lượt ứng viên đang đợi kết quả.
    'apps.matching.tasks.score_application': {'queue': 'ai-matching-batch'},
    'apps.matching.tasks.rescore_job_applications': {'queue': 'ai-matching-batch'},
    'apps.matching.tasks.*': {'queue': 'ai-matching'},
    # Geocode địa chỉ nơi làm việc (ADR-0029): gọi provider ngoài, không chặn hàng email.
    'apps.jobs.tasks.geocoding.*': {'queue': 'default'},
    'apps.jobs.tasks.*': {'queue': 'candidate-email'},
    'apps.applications.tasks.*': {'queue': 'candidate-email'},
    'apps.candidates.tasks.*': {'queue': 'candidate-email'},
}
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TASK_TIME_LIMIT = 60
CELERY_TASK_SOFT_TIME_LIMIT = 50
EMPLOYER_EVENT_RETENTION_DAYS = config('EMPLOYER_EVENT_RETENTION_DAYS', default=730, cast=int)
CANDIDATE_NOTIFICATION_RETENTION_DAYS = config(
    'CANDIDATE_NOTIFICATION_RETENTION_DAYS', default=730, cast=int
)
EMPLOYER_DOMAIN_DNS_TIMEOUT_SECONDS = config(
    'EMPLOYER_DOMAIN_DNS_TIMEOUT_SECONDS', default=3.0, cast=float
)
EMPLOYER_DOMAIN_RECHECK_BATCH_SIZE = config(
    'EMPLOYER_DOMAIN_RECHECK_BATCH_SIZE', default=100, cast=int
)
CELERY_BEAT_SCHEDULE = {
    'purge-expired-ai-runtime-metadata': {
        'task': 'apps.ai_core.tasks.purge_expired_ai_metadata',
        'schedule': 86400.0,
    },
    'recover-stale-match-analyses': {
        'task': 'apps.matching.tasks.recover_stale_analyses',
        'schedule': 60.0,
    },
    'recover-stale-job-ai-generations': {
        'task': 'apps.jobs.tasks.ai_generation.recover_stale_job_generations',
        'schedule': 5.0,
    },
    'purge-expired-job-ai-generation-content': {
        'task': 'apps.jobs.tasks.ai_generation.purge_job_generation_content',
        'schedule': 86400.0,
    },
    'process-automatic-application-rejections': {
        'task': 'apps.applications.tasks.process_automatic_application_rejections',
        'schedule': 300.0,
    },
    'send-unanswered-application-reminders': {
        'task': 'apps.applications.tasks.send_unanswered_application_reminders',
        'schedule': 3600.0,
    },
    # Huy hiệu Sấm Chớp (ADR-0027): đo lại mức phản hồi của NTD và nhãn trên tin.
    'refresh-flash-badges': {
        'task': 'apps.applications.tasks.refresh_flash_badges',
        'schedule': 3600.0,
    },
    'purge-lapsed-talent-pool-entries': {
        'task': 'apps.applications.tasks.purge_lapsed_talent_pool_entries',
        'schedule': 86400.0,
    },
    'dispatch-candidate-notifications': {
        'task': 'apps.candidates.tasks.notifications.dispatch_candidate_notifications',
        'schedule': 60.0,
    },
    'purge-expired-candidate-notifications': {
        'task': 'apps.candidates.tasks.notifications.purge_expired_candidate_notifications',
        'schedule': 86400.0,
    },
    'prepare-due-candidate-job-digests': {
        'task': 'apps.jobs.tasks.prepare_due_candidate_job_digests',
        'schedule': 300.0,
    },
    'dispatch-pending-candidate-job-digests': {
        'task': 'apps.jobs.tasks.dispatch_pending_candidate_job_digests',
        'schedule': 300.0,
    },
    'purge-candidate-job-digest-history': {
        'task': 'apps.jobs.tasks.purge_candidate_job_digest_history',
        'schedule': 86400.0,
    },
    'dispatch-pending-auth-email-jobs': {
        'task': 'apps.accounts.tasks.auth_email.dispatch_pending_auth_email_jobs',
        'schedule': 60.0,
    },
    'dispatch-pending-cv-export-jobs': {
        'task': 'apps.cvs.tasks.exports.dispatch_pending_cv_export_jobs',
        'schedule': 60.0,
    },
    'dispatch-pending-cv-import-jobs': {
        'task': 'apps.cvs.tasks.imports.dispatch_pending_cv_import_jobs',
        'schedule': 60.0,
    },
    'purge-expired-cv-import-sources': {
        'task': 'apps.cvs.tasks.imports.purge_expired_cv_import_sources',
        'schedule': 86400.0,
    },
    'dispatch-pending-upload-scans': {
        'task': 'apps.uploads.tasks.dispatch_pending_upload_scans',
        'schedule': 30.0,
    },
    'expire-and-clean-upload-sessions': {
        'task': 'apps.uploads.tasks.expire_and_clean_upload_sessions',
        'schedule': 300.0,
    },
    'recover-stale-employer-sms-dispatches': {
        'task': 'apps.employers.tasks.phone_sms.recover_stale_employer_sms_dispatches',
        'schedule': 60.0,
    },
    'purge-employer-sms-verification-data': {
        'task': 'apps.employers.tasks.phone_sms.purge_employer_sms_verification_data',
        'schedule': 86400.0,
    },
    'dispatch-pending-employer-verification-notifications': {
        'task': 'apps.employers.tasks.verification_notification.dispatch_pending_employer_verification_notifications',
        'schedule': 60.0,
    },
    'purge-expired-employer-event-history': {
        'task': 'apps.employers.tasks.notifications.purge_expired_employer_event_history',
        'schedule': 86400.0,
    },
    'run-campaign-schedule': {
        'task': 'apps.campaigns.tasks.run_campaign_schedule',
        'schedule': 300.0,
    },
    'dispatch-due-social-posts': {
        'task': 'apps.campaigns.tasks.dispatch_due_social_posts',
        'schedule': 60.0,
    },
    'reconcile-social-posts': {
        'task': 'apps.campaigns.tasks.reconcile_social_posts',
        'schedule': 300.0,
    },
    'refresh-social-tokens': {
        'task': 'apps.campaigns.tasks.refresh_social_tokens',
        'schedule': 86400.0,
    },
    'snapshot-campaign-health': {
        'task': 'apps.campaigns.tasks.snapshot_campaign_health',
        'schedule': 3600.0,
    },
    'send-campaign-weekly-reports': {
        'task': 'apps.campaigns.tasks.send_campaign_weekly_reports',
        'schedule': 3600.0,
    },
    'reconcile-company-domain-claims': {
        'task': 'apps.employers.tasks.domain_claims.reconcile_company_domain_claims',
        'schedule': 86400.0,
    },
}

# Đối sánh CV–JD chạy local (apps.matching). Mô hình chỉ nạp trong service
# `ml-worker` (image có torch); web và CI dùng bộ mã hóa `hashing` tất định.
# Đổi mô hình: sửa MATCHING_MODEL_PATH + MATCHING_MODEL_VERSION, khởi động lại
# ml-worker rồi chạy `matching_backfill` (phiên bản mô hình nằm trong khóa cache).

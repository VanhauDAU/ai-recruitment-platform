"""Cache Redis, Celery (queue, giới hạn, lịch beat) và thời hạn lưu sự kiện."""

from celery.schedules import crontab

from config.env import config

# Hai vai trò Redis, production tách thành hai instance (docker-compose.prod.yml):
# - REDIS_URL -> `redis-cache` (allkeys-lru, không lưu đĩa): cache, token xác thực
#   email, cooldown, throttle. Đầy thì đẩy key cũ ra thay vì từ chối ghi.
# - CELERY_BROKER_URL -> `redis-broker` (noeviction, AOF): hàng đợi Celery và
#   channel layer WebSocket — mất key ở đây là mất task/sự kiện.
# Dev dùng một Redis: CELERY_BROKER_URL và channel layer mặc định theo REDIS_URL.
REDIS_URL = config('REDIS_URL', default='redis://127.0.0.1:6379/1')
# Redis treo/không tới được thì request lỗi sau 2 giây, không giữ slot gunicorn
# tới lúc timeout 90 giây.
REDIS_CACHE_SOCKET_TIMEOUT_SECONDS = 2
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': REDIS_CACHE_SOCKET_TIMEOUT_SECONDS,
            'SOCKET_TIMEOUT': REDIS_CACHE_SOCKET_TIMEOUT_SECONDS,
        },
    }
}

CELERY_BROKER_URL = config('CELERY_BROKER_URL', default=REDIS_URL)

# Channel layer của WebSocket thông báo: web, worker và beat cùng đẩy sự kiện vào
# Redis, process `realtime` (daphne) chuyển tới socket đang mở. Nằm trên Redis
# broker (noeviction) vì sự kiện không được bị đẩy ra như key cache; prefix riêng
# để không đụng key Celery.
# redis-py 8 mặc định chờ đọc 5 giây, bằng đúng thời gian channels_redis chặn ở
# BZPOPMIN (`brpop_timeout = 5`), nên mỗi socket rảnh sẽ lỗi TimeoutError và bị
# ngắt sau ~5 giây. Thời gian chờ đọc phải dài hơn khoảng chặn đó — KHÔNG áp
# timeout ngắn của cache vào đây.
CHANNEL_LAYER_SOCKET_TIMEOUT = 15
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [
                {
                    # Để trống = dùng chung Redis broker.
                    'address': config('CHANNEL_LAYER_REDIS_URL', default='') or CELERY_BROKER_URL,
                    'socket_timeout': CHANNEL_LAYER_SOCKET_TIMEOUT,
                }
            ],
            'prefix': 'procv-realtime',
            'capacity': 200,
            'expiry': 30,
        },
    }
}

# Queue riêng cho email auth. Chạy worker và beat tách process khỏi web server để
# SMTP không làm chậm request đăng ký/login.
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default=None)
CELERY_TASK_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']
# TIME_ZONE (lưu trữ) là UTC; lịch crontab của beat đọc theo giờ Việt Nam để
# "giờ thấp điểm" đúng nghĩa với người dùng. Lịch theo chu kỳ giây không đổi.
CELERY_TIMEZONE = 'Asia/Ho_Chi_Minh'
# Log của worker đi qua LOGGING của Django (một dòng JSON) thay vì format riêng.
CELERY_WORKER_HIJACK_ROOT_LOGGER = False
CELERY_TASK_DEFAULT_QUEUE = 'default'
CELERY_TASK_ROUTES = {
    'apps.accounts.tasks.auth_email.*': {'queue': 'auth-email'},
    'apps.employers.tasks.phone_sms.*': {'queue': 'auth-sms'},
    'apps.employers.tasks.tax_lookup.*': {'queue': 'default'},
    'apps.employers.tasks.domain_claims.*': {'queue': 'default'},
    # PDF báo cáo chiến dịch dùng Chromium như PDF CV: chung worker có /dev/shm lớn.
    'apps.campaigns.tasks.render_campaign_report_pdf': {'queue': 'cv-export'},
    'apps.campaigns.tasks.*': {'queue': 'default'},
    'apps.cv_templates.tasks.template_assets.generate_cv_sample_content': {
        'queue': 'ai-generation'
    },
    'apps.cv_templates.tasks.template_assets.render_template_test_pdf': {'queue': 'cv-export'},
    'apps.cvs.tasks.*': {'queue': 'cv-export'},
    'apps.uploads.tasks.*': {'queue': 'upload-scan'},
    # Quét lease kẹt mỗi 5 giây: không xếp sau lượt gọi Gemini dài ~85 giây.
    'apps.jobs.tasks.ai_generation.recover_stale_job_generations': {'queue': 'default'},
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
# Phiên đăng nhập đã thu hồi/hết hạn và outbox email xác thực đã gửi xong giữ
# một thời gian để admin tra cứu, sau đó beat xóa (apps.accounts.services.retention).
AUTH_SESSION_RETENTION_DAYS = config('AUTH_SESSION_RETENTION_DAYS', default=90, cast=int)
AUTH_EMAIL_JOB_RETENTION_DAYS = config('AUTH_EMAIL_JOB_RETENTION_DAYS', default=30, cast=int)
EMPLOYER_DOMAIN_DNS_TIMEOUT_SECONDS = config(
    'EMPLOYER_DOMAIN_DNS_TIMEOUT_SECONDS', default=3.0, cast=float
)
EMPLOYER_DOMAIN_RECHECK_BATCH_SIZE = config(
    'EMPLOYER_DOMAIN_RECHECK_BATCH_SIZE', default=100, cast=int
)


def _every(seconds, **options):
    """Lịch theo chu kỳ. ``expires`` = chu kỳ (tối thiểu 30 giây): worker chậm hoặc
    dừng thì bản cũ trong hàng đợi bị bỏ, không dồn hàng trăm lượt chạy trùng."""
    return {'schedule': float(seconds), 'options': {'expires': max(seconds, 30), **options}}


def _daily(hour, minute):
    """Job dọn dữ liệu hằng ngày, giờ Việt Nam. Lệch nhau vài phút để không cùng
    lúc quét bảng lớn; tránh 03:00–03:45 (backup DB/file) và 04:30 (tự khởi động
    lại sau cập nhật bảo mật). Beat lưu lịch trên volume nên lượt lỡ vì deploy
    được chạy bù khi beat lên lại."""
    return {
        'schedule': crontab(hour=hour, minute=minute),
        'options': {'expires': 6 * 3600},
    }


CELERY_BEAT_SCHEDULE = {
    # Việc làm gần tôi (ADR-0029): geocode các địa chỉ nơi làm việc còn chờ.
    'geocode-pending-job-locations': {
        'task': 'apps.jobs.tasks.geocoding.geocode_pending_job_locations',
        **_every(600),
    },
    'recover-stale-match-analyses': {
        'task': 'apps.matching.tasks.recover_stale_analyses',
        **_every(60),
    },
    'recover-stale-job-ai-generations': {
        'task': 'apps.jobs.tasks.ai_generation.recover_stale_job_generations',
        **_every(5),
    },
    'process-automatic-application-rejections': {
        'task': 'apps.applications.tasks.process_automatic_application_rejections',
        **_every(300),
    },
    'send-unanswered-application-reminders': {
        'task': 'apps.applications.tasks.send_unanswered_application_reminders',
        **_every(3600),
    },
    # Huy hiệu Sấm Chớp (ADR-0027): đo lại mức phản hồi của NTD và nhãn trên tin.
    'refresh-flash-badges': {
        'task': 'apps.applications.tasks.refresh_flash_badges',
        **_every(3600),
    },
    'dispatch-candidate-notifications': {
        'task': 'apps.candidates.tasks.notifications.dispatch_candidate_notifications',
        **_every(60),
    },
    'prepare-due-candidate-job-digests': {
        'task': 'apps.jobs.tasks.prepare_due_candidate_job_digests',
        **_every(300),
    },
    'dispatch-pending-candidate-job-digests': {
        'task': 'apps.jobs.tasks.dispatch_pending_candidate_job_digests',
        **_every(300),
    },
    'dispatch-pending-auth-email-jobs': {
        'task': 'apps.accounts.tasks.auth_email.dispatch_pending_auth_email_jobs',
        **_every(60),
    },
    'dispatch-pending-cv-export-jobs': {
        'task': 'apps.cvs.tasks.exports.dispatch_pending_cv_export_jobs',
        **_every(60),
    },
    'dispatch-pending-cv-import-jobs': {
        'task': 'apps.cvs.tasks.imports.dispatch_pending_cv_import_jobs',
        **_every(60),
    },
    'dispatch-pending-upload-scans': {
        'task': 'apps.uploads.tasks.dispatch_pending_upload_scans',
        **_every(30),
    },
    'expire-and-clean-upload-sessions': {
        'task': 'apps.uploads.tasks.expire_and_clean_upload_sessions',
        **_every(300),
    },
    'recover-stale-employer-sms-dispatches': {
        'task': 'apps.employers.tasks.phone_sms.recover_stale_employer_sms_dispatches',
        **_every(60),
    },
    'dispatch-pending-employer-verification-notifications': {
        'task': 'apps.employers.tasks.verification_notification.dispatch_pending_employer_verification_notifications',
        **_every(60),
    },
    'run-campaign-schedule': {
        'task': 'apps.campaigns.tasks.run_campaign_schedule',
        **_every(300),
    },
    'dispatch-due-social-posts': {
        'task': 'apps.campaigns.tasks.dispatch_due_social_posts',
        **_every(60),
    },
    'reconcile-social-posts': {
        'task': 'apps.campaigns.tasks.reconcile_social_posts',
        **_every(300),
    },
    'snapshot-campaign-health': {
        'task': 'apps.campaigns.tasks.snapshot_campaign_health',
        **_every(3600),
    },
    'send-campaign-weekly-reports': {
        'task': 'apps.campaigns.tasks.send_campaign_weekly_reports',
        **_every(3600),
    },
    # ---- Hằng ngày, giờ thấp điểm (giờ Việt Nam) ----
    'flush-expired-jwt-tokens': {
        'task': 'apps.accounts.tasks.maintenance.flush_expired_jwt_tokens',
        **_daily(1, 0),
    },
    'clear-expired-django-sessions': {
        'task': 'apps.accounts.tasks.maintenance.clear_expired_django_sessions',
        **_daily(1, 5),
    },
    'purge-ended-auth-sessions': {
        'task': 'apps.accounts.tasks.maintenance.purge_ended_auth_sessions',
        **_daily(1, 10),
    },
    'purge-finished-auth-email-jobs': {
        'task': 'apps.accounts.tasks.maintenance.purge_finished_auth_email_jobs',
        **_daily(1, 15),
    },
    'purge-expired-ai-runtime-metadata': {
        'task': 'apps.ai_core.tasks.purge_expired_ai_metadata',
        **_daily(1, 20),
    },
    'purge-expired-job-ai-generation-content': {
        'task': 'apps.jobs.tasks.ai_generation.purge_job_generation_content',
        **_daily(1, 25),
    },
    'purge-lapsed-talent-pool-entries': {
        'task': 'apps.applications.tasks.purge_lapsed_talent_pool_entries',
        **_daily(1, 30),
    },
    'purge-expired-candidate-notifications': {
        'task': 'apps.candidates.tasks.notifications.purge_expired_candidate_notifications',
        **_daily(1, 40),
    },
    'purge-candidate-job-digest-history': {
        'task': 'apps.jobs.tasks.purge_candidate_job_digest_history',
        **_daily(1, 50),
    },
    'purge-expired-cv-import-sources': {
        'task': 'apps.cvs.tasks.imports.purge_expired_cv_import_sources',
        **_daily(2, 0),
    },
    'purge-employer-sms-verification-data': {
        'task': 'apps.employers.tasks.phone_sms.purge_employer_sms_verification_data',
        **_daily(2, 10),
    },
    'purge-expired-employer-event-history': {
        'task': 'apps.employers.tasks.notifications.purge_expired_employer_event_history',
        **_daily(2, 20),
    },
    'reconcile-company-domain-claims': {
        'task': 'apps.employers.tasks.domain_claims.reconcile_company_domain_claims',
        **_daily(2, 35),
    },
    'refresh-social-tokens': {
        'task': 'apps.campaigns.tasks.refresh_social_tokens',
        **_daily(5, 15),
    },
}

# Đối sánh CV–JD chạy local (apps.matching). Mô hình chỉ nạp trong service
# `ml-worker` (image có torch); web và CI dùng bộ mã hóa `hashing` tất định.
# Đổi mô hình: sửa MATCHING_MODEL_PATH + MATCHING_MODEL_VERSION, khởi động lại
# ml-worker rồi chạy `matching_backfill` (phiên bản mô hình nằm trong khóa cache).

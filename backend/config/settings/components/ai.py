"""Đối sánh CV–JD chạy local và AI tạo tin (Gemini hoặc Claude)."""

import json

from decouple import Csv

from config.env import config

from .core import IS_PRODUCTION

MATCHING_ENCODER_BACKEND = config('MATCHING_ENCODER_BACKEND', default='hashing').strip()
MATCHING_MODEL_PATH = config(
    'MATCHING_MODEL_PATH', default='/models/multilingual-e5-base/zs-v1'
).strip()
MATCHING_MODEL_VERSION = config('MATCHING_MODEL_VERSION', default='e5-base-zs-v1').strip()
# Cross-encoder phán từng yêu cầu: `none` (không dùng), `cross_encoder`, `hashing` (test).
MATCHING_RERANKER_BACKEND = config('MATCHING_RERANKER_BACKEND', default='none').strip()
MATCHING_RERANKER_PATH = config(
    'MATCHING_RERANKER_PATH', default='/models/mmarco-mMiniLMv2-L12/req-ce-v1'
).strip()
MATCHING_RERANKER_VERSION = config('MATCHING_RERANKER_VERSION', default='req-ce-v1').strip()
# Tính sẵn vector khi CV có phiên bản mới hoặc tin chuyển sang đang mở.
MATCHING_PRECOMPUTE_ENABLED = config('MATCHING_PRECOMPUTE_ENABLED', default=True, cast=bool)

# Generative AI runtime. The environment flag is the hard kill switch; site
# settings can only narrow access further. Production therefore stays disabled
# until credentials, the dedicated worker and rollout gates are ready.
AI_RUNTIME_ENABLED = config('AI_RUNTIME_ENABLED', default=not IS_PRODUCTION, cast=bool)
AI_PROVIDER_BACKEND = config('AI_PROVIDER_BACKEND', default='gemini_developer').strip()
AI_JOB_GENERATION_MODEL = config(
    'AI_JOB_GENERATION_MODEL',
    default='gemini-3.5-flash-lite',
).strip()
# Model cho trích xuất CV khi tải lên; để trống thì dùng AI_JOB_GENERATION_MODEL.
# Cùng runtime (AI_PROVIDER_BACKEND, credential, AI_RUNTIME_ENABLED) với tạo tin.
AI_CV_IMPORT_MODEL = config('AI_CV_IMPORT_MODEL', default='').strip()
AI_JOB_GENERATION_MODEL_ALLOWLIST = tuple(
    model.strip()
    for model in config(
        'AI_JOB_GENERATION_MODEL_ALLOWLIST',
        default='gemini-3.5-flash-lite',
        cast=Csv(),
    )
    if model.strip()
)
AI_JOB_GENERATION_DAILY_LIMIT = config(
    'AI_JOB_GENERATION_DAILY_LIMIT',
    default=10,
    cast=int,
)
AI_JOB_GENERATION_CONTENT_RETENTION_DAYS = config(
    'AI_JOB_GENERATION_CONTENT_RETENTION_DAYS',
    default=90,
    cast=int,
)
AI_INVOCATION_METADATA_RETENTION_DAYS = config(
    'AI_INVOCATION_METADATA_RETENTION_DAYS',
    default=365,
    cast=int,
)
AI_JOB_GENERATION_LEASE_SECONDS = config(
    'AI_JOB_GENERATION_LEASE_SECONDS',
    default=85,
    cast=int,
)
AI_PROVIDER_TIMEOUT_SECONDS = config('AI_PROVIDER_TIMEOUT_SECONDS', default=40, cast=float)
AI_PROVIDER_MAX_ATTEMPTS = config('AI_PROVIDER_MAX_ATTEMPTS', default=2, cast=int)
AI_PROVIDER_RETRY_BASE_SECONDS = config(
    'AI_PROVIDER_RETRY_BASE_SECONDS',
    default=0.5,
    cast=float,
)
AI_PROVIDER_API_VERSION = config('AI_PROVIDER_API_VERSION', default='v1').strip()
AI_MODEL_PRICING_USD = config('AI_MODEL_PRICING_USD', default='{}', cast=json.loads)
GEMINI_API_KEY = config('GEMINI_API_KEY', default='').strip()
GOOGLE_CLOUD_PROJECT = config('GOOGLE_CLOUD_PROJECT', default='').strip()
GOOGLE_CLOUD_LOCATION = config('GOOGLE_CLOUD_LOCATION', default='global').strip()
# AI_PROVIDER_BACKEND=anthropic: Claude qua Anthropic API (apps/ai_core/services/providers/claude.py).
ANTHROPIC_API_KEY = config('ANTHROPIC_API_KEY', default='').strip()
# Mức suy nghĩ của Claude (low/medium/high/xhigh/max); trống = mặc định của model.
AI_ANTHROPIC_EFFORT = config('AI_ANTHROPIC_EFFORT', default='').strip()

# Email — nhà cung cấp SMTP tuỳ ý (Gmail, SendGrid, Amazon SES, Mailgun, Postmark...).
# Chưa điền EMAIL_HOST_USER -> in ra console cho dev; điền credential vào .env là
# tự chuyển sang gửi thật (không cần đổi thêm gì). EMAIL_TIMEOUT chặn request treo

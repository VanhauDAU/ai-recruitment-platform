"""Email, URL frontend, chính sách NTD, mạng xã hội, SMS, OAuth, reCAPTCHA, VietQR."""

from config.env import config

from .core import DEBUG, IS_PRODUCTION

RECAPTCHA_SECRET_KEY = config('RECAPTCHA_SECRET_KEY', default='')
RECAPTCHA_SCORE_THRESHOLD = config('RECAPTCHA_SCORE_THRESHOLD', default=0.5, cast=float)

VIETQR_TAX_LOOKUP_ENABLED = config('VIETQR_TAX_LOOKUP_ENABLED', default=True, cast=bool)
VIETQR_TAX_LOOKUP_BASE_URL = config(
    'VIETQR_TAX_LOOKUP_BASE_URL',
    default='https://api.vietqr.io/v2/business',
)
VIETQR_TAX_LOOKUP_CONNECT_TIMEOUT = config(
    'VIETQR_TAX_LOOKUP_CONNECT_TIMEOUT',
    default=2,
    cast=float,
)
VIETQR_TAX_LOOKUP_READ_TIMEOUT = config(
    'VIETQR_TAX_LOOKUP_READ_TIMEOUT',
    default=3,
    cast=float,
)
VIETQR_TAX_LOOKUP_SUCCESS_TTL = config(
    'VIETQR_TAX_LOOKUP_SUCCESS_TTL',
    default=86400,
    cast=int,
)
VIETQR_TAX_LOOKUP_NEGATIVE_TTL = config(
    'VIETQR_TAX_LOOKUP_NEGATIVE_TTL',
    default=900,
    cast=int,
)

# khi SMTP chậm/không phản hồi.
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_USE_SSL = config('EMAIL_USE_SSL', default=False, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_TIMEOUT = config('EMAIL_TIMEOUT', default=10, cast=int)
# `or` để dòng .env bỏ trống (EMAIL_BACKEND=) vẫn rơi về default theo EMAIL_HOST_USER.
EMAIL_BACKEND = config('EMAIL_BACKEND', default='') or (
    'django.core.mail.backends.smtp.EmailBackend'
    if EMAIL_HOST_USER
    else 'django.core.mail.backends.console.EmailBackend'
)
# Người gửi hiển thị; tên có thể override runtime qua site setting `email_from_name`.
# `or` để dòng .env bỏ trống (EMAIL_FROM_ADDRESS=) vẫn rơi về địa chỉ hợp lệ.
EMAIL_FROM_NAME = config('EMAIL_FROM_NAME', default='') or 'ProCV'
EMAIL_FROM_ADDRESS = (
    config('EMAIL_FROM_ADDRESS', default='') or EMAIL_HOST_USER or 'no-reply@procv.vn'
)
DEFAULT_FROM_EMAIL = (
    config('DEFAULT_FROM_EMAIL', default='') or f'{EMAIL_FROM_NAME} <{EMAIL_FROM_ADDRESS}>'
)
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# URL frontend để dựng link xác thực trong email.
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')
EMPLOYER_FRONTEND_URL = config('EMPLOYER_FRONTEND_URL', default=FRONTEND_URL)
ADMIN_FRONTEND_URL = config('ADMIN_FRONTEND_URL', default=FRONTEND_URL)
# SEO shell fetches the built Vite document from the internal frontend service,
# then injects route-specific head tags without rendering the React body.
FRONTEND_SHELL_URL = config('FRONTEND_SHELL_URL', default=FRONTEND_URL).rstrip('/') + '/'
# Trang in PDF CV (entry `cv-print.html` của frontend). Worker mở trang này bằng
# Chromium headless và đưa document vào trực tiếp; trang không tải dữ liệu CV.
CV_PRINT_URL = config('CV_PRINT_URL', default=f'{FRONTEND_SHELL_URL}cv-print.html')
FRONTEND_SHELL_TIMEOUT_SECONDS = config(
    'FRONTEND_SHELL_TIMEOUT_SECONDS',
    default=2,
    cast=float,
)
FRONTEND_SHELL_CACHE_SECONDS = config(
    'FRONTEND_SHELL_CACHE_SECONDS',
    default=30,
    cast=int,
)
KNOWLEDGEBASE_PUBLIC_ENABLED = config(
    'KNOWLEDGEBASE_PUBLIC_ENABLED',
    default=not IS_PRODUCTION,
    cast=bool,
)
KNOWLEDGEBASE_SEARCH_INDEX_ENABLED = config(
    'KNOWLEDGEBASE_SEARCH_INDEX_ENABLED',
    default=False,
    cast=bool,
)
ADMIN_INVITATION_PATH = config('ADMIN_INVITATION_PATH', default='/admin/app/invitation')
ADMIN_PASSWORD_RESET_PATH = config('ADMIN_PASSWORD_RESET_PATH', default='/admin/app/reset-password')
EMPLOYER_EMAIL_VERIFICATION_PATH = config(
    'EMPLOYER_EMAIL_VERIFICATION_PATH', default='/tuyendung/app/account/verify'
)
EMPLOYER_PASSWORD_RESET_PATH = config(
    'EMPLOYER_PASSWORD_RESET_PATH', default='/tuyendung/app/reset-password'
)
EMPLOYER_TERMS_POLICY_VERSION = config('EMPLOYER_TERMS_POLICY_VERSION', default='2026-07-18')
EMPLOYER_DPA_POLICY_VERSION = config('EMPLOYER_DPA_POLICY_VERSION', default='').strip()
EMPLOYER_DPA_DOCUMENT_SHA256 = config('EMPLOYER_DPA_DOCUMENT_SHA256', default='').strip().lower()
# Không có mặc định: DPA phải là văn bản của chính nền tảng, khớp mã băm SHA-256.
EMPLOYER_DPA_DOCUMENT_URL = config('EMPLOYER_DPA_DOCUMENT_URL', default='').strip()
EMPLOYER_DPA_GRACE_DAYS = config('EMPLOYER_DPA_GRACE_DAYS', default=30, cast=int)
REQUIRE_APPROVED_EMPLOYER_VERIFICATION = config(
    'REQUIRE_APPROVED_EMPLOYER_VERIFICATION',
    default=False,
    cast=bool,
)

# Chiến dịch tự đăng bài lên mạng xã hội của NTD (ADR-0025). Mạng có trong
# CAMPAIGN_SOCIAL_LIVE_NETWORKS gọi API thật; mạng còn lại dùng provider giả lập,
# chạy trọn luồng kết nối/đăng/gỡ mà không gọi ra ngoài (dev, CI, demo). Xem
# docs/06-deployment/social-integrations.md. CAMPAIGN_SOCIAL_PROVIDER=facebook là
# cách bật cũ, tương đương CAMPAIGN_SOCIAL_LIVE_NETWORKS=facebook_page.
_legacy_live_networks = (
    'facebook_page' if config('CAMPAIGN_SOCIAL_PROVIDER', default='fake') == 'facebook' else ''
)
CAMPAIGN_SOCIAL_LIVE_NETWORKS = [
    network.strip()
    for network in config('CAMPAIGN_SOCIAL_LIVE_NETWORKS', default=_legacy_live_networks).split(',')
    if network.strip()
]
FACEBOOK_APP_ID = config('FACEBOOK_APP_ID', default='')
FACEBOOK_APP_SECRET = config('FACEBOOK_APP_SECRET', default='')
FACEBOOK_GRAPH_API_VERSION = config('FACEBOOK_GRAPH_API_VERSION', default='v21.0')
FACEBOOK_OAUTH_REDIRECT_URI = config(
    'FACEBOOK_OAUTH_REDIRECT_URI',
    default=f'{FRONTEND_URL.rstrip("/")}/api/employer/social/facebook/callback/',
)
# Threads có App ID/secret riêng trong use case Threads của Meta App.
THREADS_APP_ID = config('THREADS_APP_ID', default='')
THREADS_APP_SECRET = config('THREADS_APP_SECRET', default='')
THREADS_GRAPH_API_VERSION = config('THREADS_GRAPH_API_VERSION', default='v1.0')
# Mặc định {FRONTEND_URL}/api/employer/social/threads/callback/. Threads chỉ nhận
# HTTPS: máy cục bộ khai https://localhost:5173/... (xem social-integrations.md).
THREADS_OAUTH_REDIRECT_URI = config('THREADS_OAUTH_REDIRECT_URI', default='')
# LinkedIn: app có sản phẩm "Share on LinkedIn" và "Sign In with LinkedIn using
# OpenID Connect". Mặc định dùng lại app đăng nhập LinkedIn (OAUTH_LINKEDIN_*).
LINKEDIN_SOCIAL_CLIENT_ID = config('LINKEDIN_SOCIAL_CLIENT_ID', default='')
LINKEDIN_SOCIAL_CLIENT_SECRET = config('LINKEDIN_SOCIAL_CLIENT_SECRET', default='')
LINKEDIN_API_VERSION = config('LINKEDIN_API_VERSION', default='202611')
LINKEDIN_OAUTH_REDIRECT_URI = config('LINKEDIN_OAUTH_REDIRECT_URI', default='')
CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY = config('CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY', default='')
CAMPAIGN_SOCIAL_HTTP_TIMEOUT_SECONDS = config(
    'CAMPAIGN_SOCIAL_HTTP_TIMEOUT_SECONDS', default=10.0, cast=float
)

# Geocoding cho "Việc làm gần bạn" (ADR-0029): vietmap (production) | goong |
# nominatim (chỉ dev, không key) | disabled. Key là bí mật phía server; key tile
# bản đồ công khai nằm trong site setting `map_style_url`.
GEOCODING_PROVIDER = config('GEOCODING_PROVIDER', default='disabled').strip().lower()
GEOCODING_API_KEY = config('GEOCODING_API_KEY', default='').strip()
GEOCODING_TIMEOUT_SECONDS = config('GEOCODING_TIMEOUT_SECONDS', default=5.0, cast=float)
GEOCODING_USER_AGENT = config('GEOCODING_USER_AGENT', default='ProCV/1.0 (+https://procv.site)')

# Provider-neutral employer phone verification. Production remains disabled
# until Ops/Product explicitly select a gateway, sender and approved template.
EMPLOYER_SMS_OTP_ENABLED = config('EMPLOYER_SMS_OTP_ENABLED', default=False, cast=bool)
EMPLOYER_SMS_PROVIDER = config('EMPLOYER_SMS_PROVIDER', default='disabled').strip().lower()
EMPLOYER_SMS_ENDPOINT_URL = config('EMPLOYER_SMS_ENDPOINT_URL', default='').strip()
EMPLOYER_SMS_API_TOKEN = config('EMPLOYER_SMS_API_TOKEN', default='').strip()
EMPLOYER_SMS_SENDER = config('EMPLOYER_SMS_SENDER', default='').strip()
EMPLOYER_SMS_TEMPLATE_ID = config('EMPLOYER_SMS_TEMPLATE_ID', default='').strip()
EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY = config(
    'EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY', default=''
).strip()
EMPLOYER_SMS_CHALLENGE_HMAC_KEY = config('EMPLOYER_SMS_CHALLENGE_HMAC_KEY', default='').strip()
EMPLOYER_SMS_CONNECT_TIMEOUT_SECONDS = config(
    'EMPLOYER_SMS_CONNECT_TIMEOUT_SECONDS', default=2.0, cast=float
)
EMPLOYER_SMS_READ_TIMEOUT_SECONDS = config(
    'EMPLOYER_SMS_READ_TIMEOUT_SECONDS', default=5.0, cast=float
)
EMPLOYER_SMS_DISPATCH_STALE_SECONDS = config(
    'EMPLOYER_SMS_DISPATCH_STALE_SECONDS', default=300, cast=int
)
EMPLOYER_SMS_CHALLENGE_RETENTION_DAYS = 30
EMPLOYER_SMS_EVENT_RETENTION_DAYS = 730

# Xác thực email: TTL token (24h) và thời gian chờ giữa 2 lần gửi lại (giây).
EMAIL_VERIFICATION_TTL = config('EMAIL_VERIFICATION_TTL', default=60 * 60 * 24, cast=int)
EMAIL_VERIFICATION_RESEND_COOLDOWN = config(
    'EMAIL_VERIFICATION_RESEND_COOLDOWN', default=60, cast=int
)

# Đặt lại mật khẩu: TTL ngắn hơn xác thực email (30 phút) vì đây là luồng chiếm
# được tài khoản; cooldown chặn spam gửi lại tới cùng một hòm thư.
PASSWORD_RESET_TTL = config('PASSWORD_RESET_TTL', default=60 * 30, cast=int)
PASSWORD_RESET_RESEND_COOLDOWN = config('PASSWORD_RESET_RESEND_COOLDOWN', default=60, cast=int)

# Social login (OAuth Authorization Code Flow qua backend callback).
# Chưa điền client id/secret -> nút social báo "chưa cấu hình" (không crash).
OAUTH_GOOGLE_CLIENT_ID = config('OAUTH_GOOGLE_CLIENT_ID', default='')
OAUTH_GOOGLE_CLIENT_SECRET = config('OAUTH_GOOGLE_CLIENT_SECRET', default='')
OAUTH_FACEBOOK_CLIENT_ID = config('OAUTH_FACEBOOK_CLIENT_ID', default='')
OAUTH_FACEBOOK_CLIENT_SECRET = config('OAUTH_FACEBOOK_CLIENT_SECRET', default='')
OAUTH_FACEBOOK_GRAPH_VERSION = config('OAUTH_FACEBOOK_GRAPH_VERSION', default='v21.0')
OAUTH_LINKEDIN_CLIENT_ID = config('OAUTH_LINKEDIN_CLIENT_ID', default='')
OAUTH_LINKEDIN_CLIENT_SECRET = config('OAUTH_LINKEDIN_CLIENT_SECRET', default='')
# Trang callback phía frontend (backend redirect về đây kèm one_time_code hoặc error).
OAUTH_MAIN_CALLBACK_URL = config(
    'OAUTH_MAIN_CALLBACK_URL', default=f'{FRONTEND_URL}/oauth/callback'
)
OAUTH_EMPLOYER_CALLBACK_URL = config(
    'OAUTH_EMPLOYER_CALLBACK_URL', default=f'{FRONTEND_URL}/tuyendung/app/oauth/callback'
)
OAUTH_STATE_TTL = config('OAUTH_STATE_TTL', default=600, cast=int)  # state chống CSRF: 10 phút
OAUTH_CODE_TTL = config('OAUTH_CODE_TTL', default=60, cast=int)  # one_time_code đổi JWT: 60s

# API docs hữu ích ở local/staging, nhưng không public mặc định ở production.
API_DOCS_ENABLED = config('API_DOCS_ENABLED', default=DEBUG, cast=bool)

CV_IMPORT_SOURCE_RETENTION_DAYS = config('CV_IMPORT_SOURCE_RETENTION_DAYS', default=30, cast=int)

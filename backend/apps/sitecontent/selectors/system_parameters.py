"""Read-only system parameters for the admin settings page (ADR-0026).

These values are owned by ``.env``/Django settings or by code, not by
``SiteSetting``. The admin page shows the value the running process actually
uses so nobody mistakes them for editable switches. Secrets are reported only
as configured / not configured.
"""

from django.conf import settings


def _duration(seconds):
    minutes, rest = divmod(int(seconds), 60)
    if rest:
        return f'{int(seconds)} giây'
    hours, minutes_left = divmod(minutes, 60)
    if hours and not minutes_left:
        return f'{hours} giờ'
    return f'{minutes} phút'


def _megabytes(size):
    return f'{size / (1024 * 1024):g} MB'


def _configured(value):
    return 'Đã cấu hình' if value else 'Chưa cấu hình'


def _on_off(value):
    return 'Bật' if value else 'Tắt'


def _param(key, label, value, *, source='env', help_text=''):
    return {'key': key, 'label': label, 'value': value, 'source': source, 'help': help_text}


def _password_min_length():
    for validator in settings.AUTH_PASSWORD_VALIDATORS:
        if validator['NAME'].endswith('MinimumLengthValidator'):
            return validator.get('OPTIONS', {}).get('min_length', 8)
    return None


def system_parameters():
    """Grouped ``[{key, label, items: [{key, label, value, source, help}]}]``."""
    jwt = settings.SIMPLE_JWT
    return [
        {
            'key': 'auth',
            'label': 'Đăng nhập & phiên',
            'items': [
                _param(
                    'AUTH_PASSWORD_VALIDATORS',
                    'Độ dài mật khẩu tối thiểu',
                    f'{_password_min_length()} ký tự',
                    source='code',
                    help_text='Mật khẩu luôn phải có chữ hoa, chữ thường, số và ký tự đặc biệt.',
                ),
                _param(
                    'LOGIN_BACKOFF_FREE_ATTEMPTS',
                    'Số lần đăng nhập sai trước khi phải chờ',
                    str(settings.LOGIN_BACKOFF_FREE_ATTEMPTS),
                    help_text='Sau đó thời gian chờ tăng dần, không khoá cứng tài khoản.',
                ),
                _param(
                    'LOGIN_BACKOFF_MAX_SECONDS',
                    'Thời gian chờ tối đa',
                    _duration(settings.LOGIN_BACKOFF_MAX_SECONDS),
                ),
                _param(
                    'AUTH_SESSION_IDLE_TIMEOUT_SECONDS',
                    'Tự đăng xuất khi không hoạt động',
                    _duration(settings.AUTH_SESSION_IDLE_TIMEOUT_SECONDS),
                ),
                _param(
                    'JWT_ACCESS_TOKEN_MINUTES',
                    'Hạn access token',
                    _duration(jwt['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                ),
                _param(
                    'JWT_REFRESH_TOKEN_DAYS',
                    'Hạn đăng nhập (refresh token)',
                    f'{jwt["REFRESH_TOKEN_LIFETIME"].days} ngày',
                ),
                _param(
                    'ADMIN_ACCESS_TOKEN_MINUTES',
                    'Hạn access token trang quản trị',
                    f'{settings.ADMIN_ACCESS_TOKEN_MINUTES} phút',
                ),
                _param(
                    'RECAPTCHA_SECRET_KEY',
                    'reCAPTCHA',
                    _configured(settings.RECAPTCHA_SECRET_KEY),
                    help_text='Bắt buộc ở production; khi đã cấu hình, mọi form đăng nhập/đăng ký đều kiểm tra.',
                ),
            ],
        },
        {
            'key': 'uploads',
            'label': 'Tải tệp',
            'items': [
                _param(
                    'IMAGE_UPLOAD_MAX_SIZE',
                    'Ảnh tối đa',
                    _megabytes(settings.IMAGE_UPLOAD_MAX_SIZE),
                    help_text='Áp dụng cho avatar, logo, ảnh bài viết và ảnh cấu hình.',
                ),
                _param(
                    'UPLOAD_MAX_BYTES',
                    'Tệp tối đa mỗi phiên upload',
                    _megabytes(settings.UPLOAD_MAX_BYTES),
                ),
                _param(
                    'UPLOAD_OWNER_MAX_ACTIVE_SESSIONS',
                    'Số phiên upload đồng thời mỗi người',
                    str(settings.UPLOAD_OWNER_MAX_ACTIVE_SESSIONS),
                ),
            ],
        },
        {
            'key': 'jobs',
            'label': 'Tin tuyển dụng',
            'items': [
                _param(
                    'JOB_POSTING_DEFAULT_DEADLINE_DAYS',
                    'Hạn nộp hồ sơ gợi ý',
                    f'{settings.JOB_POSTING_DEFAULT_DEADLINE_DAYS} ngày',
                ),
                _param(
                    'JOB_POSTING_MAX_DEADLINE_DAYS',
                    'Hạn nộp hồ sơ tối đa',
                    f'{settings.JOB_POSTING_MAX_DEADLINE_DAYS} ngày',
                ),
                _param(
                    'PAGE_SIZE',
                    'Số kết quả mỗi trang danh sách',
                    str(settings.REST_FRAMEWORK['PAGE_SIZE']),
                    source='code',
                ),
            ],
        },
        {
            'key': 'policies',
            'label': 'Chính sách & xác thực',
            'items': [
                _param(
                    'REQUIRE_APPROVED_EMPLOYER_VERIFICATION',
                    'Bắt buộc nhà tuyển dụng được duyệt xác thực',
                    _on_off(settings.REQUIRE_APPROVED_EMPLOYER_VERIFICATION),
                ),
                _param(
                    'EMPLOYER_BADGE_POLICY_MODE',
                    'Chế độ dấu tick xác thực',
                    settings.EMPLOYER_BADGE_POLICY_MODE,
                ),
                _param(
                    'CONSENT_POLICY_VERSION',
                    'Phiên bản chính sách cookie',
                    str(settings.CONSENT_POLICY_VERSION),
                ),
                _param(
                    'EMPLOYER_TERMS_POLICY_VERSION',
                    'Phiên bản điều khoản nhà tuyển dụng',
                    settings.EMPLOYER_TERMS_POLICY_VERSION or '—',
                ),
            ],
        },
        {
            'key': 'platform',
            'label': 'Email & dịch vụ',
            'items': [
                _param(
                    'EMAIL_BACKEND',
                    'Cách gửi email',
                    settings.EMAIL_BACKEND.rsplit('.', 2)[-2],
                    help_text='"smtp" là gửi thật; "console"/"locmem" chỉ in ra log.',
                ),
                _param('EMAIL_HOST_USER', 'Tài khoản SMTP', _configured(settings.EMAIL_HOST_USER)),
                _param('EMAIL_FROM_ADDRESS', 'Địa chỉ gửi', settings.EMAIL_FROM_ADDRESS),
                _param(
                    'AI_RUNTIME_ENABLED',
                    'AI sinh nội dung (công tắc máy chủ)',
                    _on_off(settings.AI_RUNTIME_ENABLED),
                    help_text='Tắt ở đây thì mọi công tắc AI trong trang cấu hình không có tác dụng.',
                ),
                _param(
                    'KNOWLEDGEBASE_PUBLIC_ENABLED',
                    'Trung tâm trợ giúp công khai',
                    _on_off(settings.KNOWLEDGEBASE_PUBLIC_ENABLED),
                ),
            ],
        },
    ]

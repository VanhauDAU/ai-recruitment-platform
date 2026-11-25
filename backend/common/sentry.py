"""Gửi lỗi lên Sentry (chỉ khi có ``SENTRY_DSN``), không kèm dữ liệu cá nhân.

``send_default_pii=False`` đã bỏ IP, cookie và user; ``scrub_event`` cắt thêm
những gì SDK vẫn gửi: body request (mật khẩu, CV, OTP), query string (token đặt
lại mật khẩu, mã OAuth), cookie và header xác thực.
"""

SENSITIVE_HEADERS = frozenset(
    {'authorization', 'cookie', 'set-cookie', 'x-csrftoken', 'proxy-authorization'}
)
FILTERED = '[Filtered]'


def scrub_event(event, hint=None):
    request = event.get('request')
    if isinstance(request, dict):
        request.pop('data', None)
        request.pop('cookies', None)
        if request.get('query_string'):
            request['query_string'] = FILTERED
        headers = request.get('headers')
        if isinstance(headers, dict):
            request['headers'] = {
                key: FILTERED if key.lower() in SENSITIVE_HEADERS else value
                for key, value in headers.items()
            }
    return event


def init_sentry(*, dsn, environment, release, traces_sample_rate):
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        release=release or None,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        send_default_pii=False,
        max_request_body_size='never',
        before_send=scrub_event,
        before_send_transaction=scrub_event,
        traces_sample_rate=traces_sample_rate,
    )

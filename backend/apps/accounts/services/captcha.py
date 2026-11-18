"""reCAPTCHA verification integration for account entry points."""

import requests
from django.conf import settings
from rest_framework.exceptions import ValidationError

from common.http.client_ip import client_ip

RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'


def verify_request_captcha(request, action):
    """Verify the token submitted with an HTTP request for the given action."""
    # Behind nginx REMOTE_ADDR is the proxy itself; Google scores the token
    # against the end user's address, so resolve it through the trusted hops.
    token = request.data.get('captcha_token') if request else None
    verify_recaptcha(token, action, client_ip(request))


def verify_recaptcha(token, action, remote_ip=None):
    if not settings.RECAPTCHA_SECRET_KEY:
        if settings.DEBUG:
            return
        raise RuntimeError('RECAPTCHA_SECRET_KEY chưa được cấu hình.')

    if not token:
        raise ValidationError({'captcha_token': 'Vui lòng xác thực captcha.'})

    payload = {'secret': settings.RECAPTCHA_SECRET_KEY, 'response': token}
    if remote_ip:
        payload['remoteip'] = remote_ip

    try:
        response = requests.post(RECAPTCHA_VERIFY_URL, data=payload, timeout=5)
        result = response.json()
    except (requests.RequestException, ValueError) as error:
        raise ValidationError(
            {'captcha_token': 'Không thể xác thực captcha, vui lòng thử lại.'}
        ) from error

    if not result.get('success'):
        raise ValidationError({'captcha_token': 'Xác thực captcha thất bại.'})
    if 'action' in result and result.get('action') != action:
        raise ValidationError({'captcha_token': 'Captcha không hợp lệ cho hành động này.'})
    if 'score' in result and result.get('score', 0) < settings.RECAPTCHA_SCORE_THRESHOLD:
        raise ValidationError({'captcha_token': 'Xác thực captcha thất bại (độ tin cậy thấp).'})

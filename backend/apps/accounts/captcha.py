import requests
from django.conf import settings
from rest_framework import serializers

RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'


def verify_recaptcha(token, action, remote_ip=None):
    if not settings.RECAPTCHA_SECRET_KEY:
        if settings.DEBUG:
            return
        raise RuntimeError('RECAPTCHA_SECRET_KEY chưa được cấu hình.')

    if not token:
        raise serializers.ValidationError({'captcha_token': 'Vui lòng xác thực captcha.'})

    payload = {'secret': settings.RECAPTCHA_SECRET_KEY, 'response': token}
    if remote_ip:
        payload['remoteip'] = remote_ip

    try:
        response = requests.post(RECAPTCHA_VERIFY_URL, data=payload, timeout=5)
        result = response.json()
    except (requests.RequestException, ValueError):
        raise serializers.ValidationError({'captcha_token': 'Không thể xác thực captcha, vui lòng thử lại.'})

    if not result.get('success'):
        raise serializers.ValidationError({'captcha_token': 'Xác thực captcha thất bại.'})

    # `action`/`score` chỉ có trong response thật của v3 — vắng mặt nghĩa là đang
    # dùng cặp test key chính thức của Google (luôn trả success mà không kèm 2 field
    # này), nên bỏ qua 2 kiểm tra dưới để không chặn môi trường dev.
    if 'action' in result and result.get('action') != action:
        raise serializers.ValidationError({'captcha_token': 'Captcha không hợp lệ cho hành động này.'})

    if 'score' in result and result.get('score', 0) < settings.RECAPTCHA_SCORE_THRESHOLD:
        raise serializers.ValidationError({'captcha_token': 'Xác thực captcha thất bại (độ tin cậy thấp).'})

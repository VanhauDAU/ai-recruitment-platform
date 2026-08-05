"""Làm chậm dần việc dò mật khẩu theo từng tài khoản (email, cổng).

Throttle theo IP không chặn được tấn công phân tán: mỗi IP chỉ cần vài lượt là
đủ, gộp hàng nghìn IP lại thì một tài khoản vẫn bị dò thoải mái. Bộ đếm ở đây
bám danh tính tài khoản nên không phụ thuộc kẻ tấn công đến từ đâu.

Cố ý KHÔNG khoá cứng tài khoản: khoá cứng biến chính cơ chế bảo vệ thành công cụ
DoS — biết email của một nhà tuyển dụng là khoá được họ khỏi hệ thống. Thay vào
đó mỗi lần sai kế tiếp phải chờ lâu gấp đôi, đủ để dập brute-force mà người dùng
thật gõ nhầm vài lần vẫn vào được ngay.

Khoá đếm gồm cả cổng: mô hình tách tài khoản theo cổng nghĩa là tài khoản ứng
viên và NTD cùng email là hai danh tính độc lập, khoá nhịp bên này không được
ảnh hưởng bên kia.
"""

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework.exceptions import Throttled

_PREFIX = 'login_guard:'


def _key(email, portal):
    return f'{_PREFIX}{portal}:{email}'


def _delay_seconds(failures):
    """Chờ bao lâu sau lần sai thứ ``failures``. 0 nghĩa là chưa phải chờ."""
    over = failures - settings.LOGIN_BACKOFF_FREE_ATTEMPTS
    if over <= 0:
        return 0
    return min(
        settings.LOGIN_BACKOFF_BASE_SECONDS * 2 ** (over - 1),
        settings.LOGIN_BACKOFF_MAX_SECONDS,
    )


def _state(email, portal):
    return cache.get(_key(email, portal)) or {'failures': 0, 'blocked_until': None}


def ensure_not_throttled(email, portal):
    """Chặn sớm nếu tài khoản này còn trong thời gian phải chờ."""
    blocked_until = _state(email, portal)['blocked_until']
    if not blocked_until:
        return
    remaining = blocked_until - timezone.now().timestamp()
    if remaining > 0:
        raise Throttled(wait=int(remaining) + 1)


def register_failure(email, portal):
    """Ghi nhận một lần đăng nhập sai và trả về số giây phải chờ tiếp theo."""
    state = _state(email, portal)
    failures = state['failures'] + 1
    delay = _delay_seconds(failures)
    cache.set(
        _key(email, portal),
        {
            'failures': failures,
            'blocked_until': timezone.now().timestamp() + delay if delay else None,
        },
        settings.LOGIN_BACKOFF_WINDOW_SECONDS,
    )
    return delay


def clear(email, portal):
    """Đăng nhập đúng xoá sạch lịch sử: người dùng thật không bị phạt kéo dài."""
    cache.delete(_key(email, portal))

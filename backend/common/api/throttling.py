"""Throttle bám IP client đã kiểm chứng thay vì header client tự khai.

``rest_framework.throttling.BaseThrottle.get_ident`` khi ``NUM_PROXIES`` không
được cấu hình sẽ lấy NGUYÊN chuỗi ``X-Forwarded-For`` làm khoá. Kẻ tấn công chỉ
cần đổi header mỗi request là có bucket mới, tức mọi giới hạn của các endpoint
đăng nhập/đăng ký/OTP đều vô hiệu. Ở đây dùng lại quy tắc proxy tin cậy dùng
chung với nhận diện phiên đăng nhập.

Phần cuối file là trần ghi theo tài khoản (ADR-0031): mọi request ghi của người
đã đăng nhập đều có giới hạn, kể cả view chưa từng nghĩ tới throttle.
"""

import logging

from rest_framework.permissions import SAFE_METHODS
from rest_framework.settings import api_settings
from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle

from common.http.client_ip import client_ip


class ClientIPScopedRateThrottle(ScopedRateThrottle):
    def get_ident(self, request):
        return client_ip(request) or super().get_ident(request)

    def get_cache_key(self, request, view):
        """Always key by trusted client IP, including authenticated requests.

        DRF's default implementation silently switches to ``user.pk`` once a
        request is authenticated, which defeats the explicit IP boundary this
        class promises. Endpoints that need both controls compose this throttle
        with ``ScopedRateThrottle``.
        """
        ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class SuffixedScopedRateThrottleMixin:
    """Give composed account/IP throttles independent rates and cache buckets.

    DRF normally copies one ``view.throttle_scope`` into every scoped throttle
    attached to that view.  Composing an account throttle with an IP throttle
    would therefore force both boundaries to share the same (usually very
    strict) rate.  Subclasses set a suffix so settings can tune the two abuse
    boundaries independently.
    """

    scope_suffix = ''

    def allow_request(self, request, view):
        base_scope = getattr(view, self.scope_attr, None)
        if not base_scope:
            return True
        if not self.scope_suffix:
            raise ValueError('scope_suffix is required')

        self.scope = f'{base_scope}_{self.scope_suffix}'
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)
        return SimpleRateThrottle.allow_request(self, request, view)


class PublicApiAnonRateThrottle(SimpleRateThrottle):
    """Trần chung cho khách chưa đăng nhập gọi ``/api/public/*``, theo IP đã kiểm chứng.

    Nằm trong ``DEFAULT_THROTTLE_CLASSES`` nên chỉ áp cho view KHÔNG tự khai
    ``throttle_classes``: view đã có throttle riêng (thường chặt hơn) giữ
    nguyên. Người đã đăng nhập không tính vào đây để văn phòng chung một IP
    không chặn lẫn nhau; các cổng có xác thực tự giới hạn theo tài khoản.
    """

    scope = 'public_api_anon'
    path_prefix = '/api/public/'

    def get_cache_key(self, request, view):
        if not request.path.startswith(self.path_prefix) or request.user.is_authenticated:
            return None
        ident = client_ip(request) or self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


logger = logging.getLogger(__name__)


class AccountWriteRateThrottle(SimpleRateThrottle):
    """Trần tần suất ghi theo tài khoản đã đăng nhập (ADR-0031).

    Chỉ tính request ghi (POST/PUT/PATCH/DELETE) của người đã đăng nhập, khóa
    theo ``user.pk`` nên văn phòng chung IP không chặn lẫn nhau. Khách và lượt
    đọc không tính: khách đã có ``PublicApiAnonRateThrottle``/throttle IP riêng.
    Tài khoản quản trị dùng scope ``<scope>_admin`` (mức rộng hơn) vì thao tác
    hàng loạt trong trang quản trị là chuyện thường ngày.

    Kế thừa ``SimpleRateThrottle`` chứ không phải ``ScopedRateThrottle``: trần
    không đọc ``view.throttle_scope`` nên đứng song song với scope riêng của
    view mà không giành rate của nhau.
    """

    def __init__(self):
        # Rate chọn theo từng request (scope thường hay scope admin) ở allow_request.
        pass

    def allow_request(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated:
            return True
        base_scope = type(self).scope
        self.scope = f'{base_scope}_admin' if getattr(user, 'is_admin_role', False) else base_scope
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)
        self.user_pk = user.pk
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': request.user.pk}

    def throttle_failure(self):
        # Chỉ ghi scope + pk (không email/IP) để chỉnh mức khi diễn tập go-live.
        logger.warning('Account write throttled: scope=%s user=%s', self.scope, self.user_pk)
        return super().throttle_failure()


class AccountWriteBurstThrottle(AccountWriteRateThrottle):
    """Chặn vòng lặp/script bắn liên tục trong thời gian ngắn."""

    scope = 'account_write_burst'


class AccountWriteSustainedThrottle(AccountWriteRateThrottle):
    """Chặn tài khoản ghi đều nhưng vượt xa nhịp người dùng thật trong một giờ."""

    scope = 'account_write_sustained'


ACCOUNT_WRITE_THROTTLES = (AccountWriteBurstThrottle, AccountWriteSustainedThrottle)


def with_account_write_cap(*throttle_classes):
    """Giữ throttle riêng của view và gắn thêm trần ghi theo tài khoản.

    DRF THAY THẾ hẳn ``DEFAULT_THROTTLE_CLASSES`` khi view tự khai
    ``throttle_classes``, nên view có throttle riêng phải tự gắn lại trần.
    ``common/tests/test_throttle_coverage.py`` quét mọi route ghi để không sót.
    """
    return [*throttle_classes, *ACCOUNT_WRITE_THROTTLES]


def with_default_throttles(*throttle_classes):
    """Danh sách mặc định của dự án (khách /api/public + trần ghi) cộng throttle riêng."""
    return [*api_settings.DEFAULT_THROTTLE_CLASSES, *throttle_classes]


class WriteScopedRateThrottle(ScopedRateThrottle):
    """Scope riêng cho thao tác ghi rủi ro cao; lượt đọc cùng view không tốn lượt.

    View khai ``throttle_scope_methods = ('POST',)`` để chỉ tính một số method
    ghi (ví dụ khởi chạy chiến dịch nhưng không tính lượt sửa/xóa). Người đã
    đăng nhập khóa theo ``user.pk``; khách theo IP đã kiểm chứng.
    """

    def allow_request(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        methods = getattr(view, 'throttle_scope_methods', None)
        if methods is not None and request.method not in methods:
            return True
        return super().allow_request(request, view)

    def get_ident(self, request):
        return client_ip(request) or super().get_ident(request)

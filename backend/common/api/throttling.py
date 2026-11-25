"""Throttle bám IP client đã kiểm chứng thay vì header client tự khai.

``rest_framework.throttling.BaseThrottle.get_ident`` khi ``NUM_PROXIES`` không
được cấu hình sẽ lấy NGUYÊN chuỗi ``X-Forwarded-For`` làm khoá. Kẻ tấn công chỉ
cần đổi header mỗi request là có bucket mới, tức mọi giới hạn của các endpoint
đăng nhập/đăng ký/OTP đều vô hiệu. Ở đây dùng lại quy tắc proxy tin cậy dùng
chung với nhận diện phiên đăng nhập.
"""

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

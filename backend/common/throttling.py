"""Throttle bám IP client đã kiểm chứng thay vì header client tự khai.

``rest_framework.throttling.BaseThrottle.get_ident`` khi ``NUM_PROXIES`` không
được cấu hình sẽ lấy NGUYÊN chuỗi ``X-Forwarded-For`` làm khoá. Kẻ tấn công chỉ
cần đổi header mỗi request là có bucket mới, tức mọi giới hạn của các endpoint
đăng nhập/đăng ký/OTP đều vô hiệu. Ở đây dùng lại quy tắc proxy tin cậy dùng
chung với nhận diện phiên đăng nhập.
"""

from rest_framework.throttling import ScopedRateThrottle

from .client_ip import client_ip


class ClientIPScopedRateThrottle(ScopedRateThrottle):
    def get_ident(self, request):
        return client_ip(request) or super().get_ident(request)

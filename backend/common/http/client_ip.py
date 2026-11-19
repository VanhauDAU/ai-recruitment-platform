"""Địa chỉ IP thật của client khi ứng dụng chạy sau reverse proxy.

``X-Forwarded-For`` là dữ liệu client gửi lên được, và nginx dùng
``$proxy_add_x_forwarded_for`` nên nó **nối** giá trị client tự khai rồi mới ghi
thêm phần mình quan sát được vào cuối. Hệ quả: các phần tử bên trái là lời khai
của người dùng, chỉ ``TRUSTED_PROXY_HOPS`` phần tử ngoài cùng bên phải mới do
proxy của mình ghi và đáng tin.

Lấy nhầm phần tử đầu chuỗi nghĩa là để client tự chọn danh tính mạng của mình —
đủ để lách mọi giới hạn theo IP và giả mạo IP hiển thị trong danh sách thiết bị.

``TRUSTED_PROXY_IPS`` khai các dải được quyền nói thay client; rỗng nghĩa là
không tin ai, chỉ dùng ``REMOTE_ADDR``.
"""

from ipaddress import ip_address, ip_network

from django.conf import settings


def is_trusted_proxy(remote):
    if not remote:
        return False
    try:
        address = ip_address(remote)
    except ValueError:
        return False
    return any(address in ip_network(entry, strict=False) for entry in settings.TRUSTED_PROXY_IPS)


def client_ip(request):
    """IP của client, hoặc ``None`` khi request không mang thông tin nào."""
    if request is None:
        return None
    remote = request.META.get('REMOTE_ADDR') or None
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if not forwarded or not is_trusted_proxy(remote):
        return remote

    addresses = [part.strip() for part in forwarded.split(',') if part.strip()]
    hops = settings.TRUSTED_PROXY_HOPS
    if not addresses or hops < 1:
        return remote
    # Đếm từ phải sang: bỏ qua đúng số hop proxy của mình. Chuỗi ngắn hơn dự kiến
    # nghĩa là có hop không ghi header — khi đó phần tử ngoài cùng bên trái là
    # thứ xa nhất còn kiểm chứng được.
    return addresses[-min(hops, len(addresses))]

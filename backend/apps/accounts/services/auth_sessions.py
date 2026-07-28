"""Vòng đời phiên đăng nhập theo thiết bị (AuthSession).

Bảng `AuthSession` là nguồn enforcement cho phiên thiết bị. Một thiết bị được
nhận diện trong phạm vi một tài khoản/cổng bằng IP và User-Agent; đăng nhập lại
từ cùng dấu hiệu sẽ cập nhật phiên có sẵn thay vì thêm dòng mới. `id` được nhúng
vào JWT dưới claim ``sid``. Refresh xoay vòng cập nhật ``refresh_jti``; access
token bị từ chối ngay khi phiên revoked, idle/absolute-expired hoặc tài khoản
không còn được phép truy cập.
"""

from datetime import timedelta
from ipaddress import ip_address, ip_network

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import datetime_from_epoch

from ..models import AuthSession
from .refresh_cookies import refresh_from_request

SID_CLAIM = 'sid'


def _client_ip(request):
    if request is None:
        return None
    remote = request.META.get('REMOTE_ADDR') or None
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded and _is_trusted_proxy(remote):
        # Chỉ proxy đã cấu hình mới được quyền khai báo địa chỉ client.
        return forwarded.split(',')[0].strip() or None
    return remote


def _is_trusted_proxy(remote):
    if not remote:
        return False
    try:
        address = ip_address(remote)
        return any(
            address in ip_network(entry, strict=False) for entry in settings.TRUSTED_PROXY_IPS
        )
    except ValueError:
        return False


def _user_agent(request):
    return request.META.get('HTTP_USER_AGENT', '') if request is not None else ''


def parse_device_label(user_agent):
    """Nhãn thiết bị gọn cho người dùng, suy từ User-Agent (không cần thư viện ngoài)."""
    if not user_agent:
        return 'Thiết bị không xác định'
    ua = user_agent.lower()
    if 'edg/' in ua or 'edge' in ua:
        browser = 'Edge'
    elif 'opr/' in ua or 'opera' in ua:
        browser = 'Opera'
    elif 'chrome' in ua and 'chromium' not in ua:
        browser = 'Chrome'
    elif 'firefox' in ua:
        browser = 'Firefox'
    elif 'safari' in ua:
        browser = 'Safari'
    else:
        browser = 'Trình duyệt khác'

    if 'iphone' in ua or 'ipad' in ua or 'ios' in ua:
        os_name = 'iOS'
    elif 'android' in ua:
        os_name = 'Android'
    elif 'windows' in ua:
        os_name = 'Windows'
    elif 'mac os' in ua or 'macintosh' in ua:
        os_name = 'macOS'
    elif 'linux' in ua:
        os_name = 'Linux'
    else:
        os_name = 'Hệ điều hành khác'

    return f'{browser} trên {os_name}'


def _ensure_outstanding(token):
    """Đảm bảo OutstandingToken tồn tại cho jti để có thể thu hồi theo jti sau này.

    `RefreshToken.for_user` ghi lúc phát lần đầu, nhưng token XOAY VÒNG không được
    ghi lại — nếu thiếu thì thu hồi-theo-jti sẽ vô hiệu."""
    OutstandingToken.objects.get_or_create(
        jti=token[api_settings.JTI_CLAIM],
        defaults={
            'user_id': token.get(api_settings.USER_ID_CLAIM),
            'token': str(token),
            'created_at': timezone.now(),
            'expires_at': datetime_from_epoch(token['exp']),
        },
    )


def start_session(user, refresh, request, *, auth_method='password'):
    """Khởi tạo hoặc cập nhật phiên của cùng thiết bị rồi gắn claim ``sid``.

    Không gộp chỉ theo IP: nhiều người hoặc thiết bị có thể cùng Wi-Fi/NAT. Khi
    thiếu IP/User-Agent (ví dụ tác vụ hệ thống/test), luôn tạo phiên độc lập để
    không suy đoán sai danh tính thiết bị.
    """
    client_ip = _client_ip(request)
    user_agent = _user_agent(request)[:400]
    now = timezone.now()
    new_jti = refresh[api_settings.JTI_CLAIM]

    with transaction.atomic():
        matches = []
        if client_ip and user_agent:
            matches = list(
                AuthSession.objects.select_for_update()
                .filter(
                    user=user,
                    portal=user.role,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    revoked_at__isnull=True,
                    expires_at__gt=now,
                )
                .order_by('-last_seen_at')
            )

        if matches:
            session = matches[0]
            # Các bản ghi cũ từ trước khi có cơ chế gộp không còn là phiên hợp lệ.
            for duplicate in matches[1:]:
                revoke_session(duplicate)
            _blacklist_jti(session.refresh_jti)
            session.refresh_jti = new_jti
            session.auth_method = auth_method
            session.device_label = parse_device_label(user_agent)
            session.last_seen_at = now
            session.reauthenticated_at = now
            session.expires_at = now + api_settings.REFRESH_TOKEN_LIFETIME
            session.save(
                update_fields=[
                    'refresh_jti',
                    'auth_method',
                    'device_label',
                    'last_seen_at',
                    'reauthenticated_at',
                    'expires_at',
                ]
            )
        else:
            session = AuthSession.objects.create(
                user=user,
                portal=user.role,
                refresh_jti=new_jti,
                auth_method=auth_method,
                device_label=parse_device_label(user_agent),
                user_agent=user_agent,
                ip_address=client_ip,
                expires_at=now + api_settings.REFRESH_TOKEN_LIFETIME,
            )
    refresh[SID_CLAIM] = str(session.id)
    return session


def rotate_session(session, new_refresh_str):
    """Đồng bộ phiên khi refresh xoay vòng: chuyển sang jti mới + bump last_seen."""
    new_refresh = RefreshToken(new_refresh_str)
    _ensure_outstanding(new_refresh)
    new_jti = new_refresh[api_settings.JTI_CLAIM]
    session.refresh_jti = new_jti
    session.last_seen_at = timezone.now()
    session.save(update_fields=['refresh_jti', 'last_seen_at'])
    return session


def locked_refresh_session(*, sid, user_id, refresh_jti):
    """Lock and return the exact live session represented by a refresh JWT."""
    if not sid:
        return None
    return (
        AuthSession.objects.select_for_update()
        .filter(
            id=sid,
            user_id=user_id,
            refresh_jti=refresh_jti,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .first()
    )


def active_session_for_access(*, sid, user):
    """Enforce immediate access-token revocation and idle/absolute timeouts."""
    if not sid:
        return None
    session = AuthSession.objects.filter(
        id=sid,
        user=user,
        portal=user.role,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if session is None:
        return None

    now = timezone.now()
    idle_timeout = settings.AUTH_SESSION_IDLE_TIMEOUT_SECONDS
    if idle_timeout > 0 and session.last_seen_at <= now - timedelta(seconds=idle_timeout):
        revoke_session(session)
        return None

    touch_interval = settings.AUTH_SESSION_TOUCH_INTERVAL_SECONDS
    if touch_interval <= 0 or session.last_seen_at <= now - timedelta(seconds=touch_interval):
        AuthSession.objects.filter(pk=session.pk, revoked_at__isnull=True).update(last_seen_at=now)
        session.last_seen_at = now
    return session


def current_session(request, user):
    """Phiên thiết bị đang giữ ĐỒNG THỜI access token (`sid`) và refresh cookie.

    Thao tác nhạy cảm không được tin mỗi access token: kẻ chiếm được token vẫn
    thiếu cookie `HttpOnly`. Trả ``None`` khi thiếu một trong hai, khi hai bên
    trỏ về phiên/tài khoản khác nhau, hoặc khi phiên đã bị thu hồi/hết hạn.
    """
    sid = request.auth.get(SID_CLAIM) if request.auth else None
    refresh_string = refresh_from_request(request, user=user)
    if not sid or not refresh_string:
        return None
    try:
        refresh = RefreshToken(refresh_string)
    except TokenError:
        return None
    if refresh.get(SID_CLAIM) != sid:
        return None
    if str(refresh.get(api_settings.USER_ID_CLAIM)) != str(user.pk):
        return None
    return active_sessions(user).filter(id=sid, refresh_jti=refresh[api_settings.JTI_CLAIM]).first()


def requires_oauth_reauthentication(user, session):
    """Đặt mật khẩu LẦN ĐẦU không có `current_password` để chứng minh chủ sở hữu.

    Bằng chứng thay thế là một lần đăng nhập OAuth vừa diễn ra trên chính phiên
    này, nên token bị đánh cắp không tự đặt được mật khẩu để chiếm tài khoản.
    """
    return not user.has_usable_password() and not is_recent_oauth_reauthentication(session)


def is_recent_oauth_reauthentication(session):
    return bool(
        session
        and session.auth_method == 'oauth'
        and session.reauthenticated_at
        and session.reauthenticated_at
        > timezone.now() - timedelta(seconds=settings.AUTH_REAUTH_MAX_AGE_SECONDS)
    )


def is_recent_reauthentication(session):
    return bool(
        session
        and session.reauthenticated_at
        and session.reauthenticated_at
        > timezone.now() - timedelta(seconds=settings.AUTH_REAUTH_MAX_AGE_SECONDS)
    )


def _blacklist_jti(jti):
    outstanding = OutstandingToken.objects.filter(jti=jti).first()
    if outstanding:
        BlacklistedToken.objects.get_or_create(token=outstanding)


def revoke_session(session):
    """Thu hồi một phiên: blacklist refresh token của nó + đánh dấu revoked."""
    if session.revoked_at is None:
        session.revoked_at = timezone.now()
        session.save(update_fields=['revoked_at'])
    _blacklist_jti(session.refresh_jti)


def revoke_session_by_refresh_jti(jti):
    """Đánh dấu phiên trùng jti là đã thu hồi (dùng từ endpoint logout đơn lẻ)."""
    session = AuthSession.objects.filter(refresh_jti=jti, revoked_at__isnull=True).first()
    if session:
        session.revoked_at = timezone.now()
        session.save(update_fields=['revoked_at'])


def mark_all_revoked(user):
    """Đánh dấu mọi phiên còn sống của user là revoked (đi cùng blacklist toàn bộ)."""
    AuthSession.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())


def active_sessions(user):
    return AuthSession.objects.filter(
        user=user,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    )

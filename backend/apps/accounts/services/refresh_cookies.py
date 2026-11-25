"""Portal-scoped HttpOnly refresh-cookie contract."""

import time

from django.conf import settings
from rest_framework_simplejwt.state import token_backend

from ..models import User

PORTAL_BY_ROLE = {
    User.Role.CANDIDATE: 'main',
    User.Role.EMPLOYER: 'employer',
    User.Role.ADMIN: 'admin',
}
VALID_PORTALS = frozenset(PORTAL_BY_ROLE.values())
# Role của tài khoản tương ứng mỗi cổng — dùng để resolve đúng tài khoản khi
# đăng nhập/đăng ký/quên mật khẩu (một email có thể có nhiều tài khoản khác cổng).
PORTAL_ROLE_BY_NAME = {portal: role for role, portal in PORTAL_BY_ROLE.items()}


def portal_for_user(user):
    return PORTAL_BY_ROLE[user.role]


def cookie_name(portal):
    if portal not in VALID_PORTALS:
        return None
    return f'{settings.AUTH_REFRESH_COOKIE_PREFIX}_{portal}'


def refresh_from_request(request, *, portal=None, user=None):
    selected_portal = portal_for_user(user) if user is not None else portal
    name = cookie_name(selected_portal)
    return request.COOKIES.get(name) if name else None


def set_refresh_cookie(response, refresh, *, user):
    response.set_cookie(
        cookie_name(portal_for_user(user)),
        refresh,
        # Cookie sống đúng bằng phần còn lại của refresh JWT (= hạn phiên của cổng).
        max_age=max(0, int(token_backend.decode(refresh, verify=False)['exp'] - time.time())),
        httponly=True,
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
        domain=settings.AUTH_REFRESH_COOKIE_DOMAIN,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
    )
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


def clear_refresh_cookie(response, *, portal):
    name = cookie_name(portal)
    if name:
        response.delete_cookie(
            name,
            domain=settings.AUTH_REFRESH_COOKIE_DOMAIN,
            path=settings.AUTH_REFRESH_COOKIE_PATH,
            samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
        )
    response['Cache-Control'] = 'no-store'
    return response

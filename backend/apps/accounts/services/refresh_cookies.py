"""Portal-scoped HttpOnly refresh-cookie contract."""

from django.conf import settings

from ..models import User


PORTAL_BY_ROLE = {
    User.Role.CANDIDATE: 'main',
    User.Role.EMPLOYER: 'employer',
    User.Role.ADMIN: 'admin',
}
VALID_PORTALS = frozenset(PORTAL_BY_ROLE.values())


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
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
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

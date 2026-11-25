"""Cloudflare Access làm lớp MFA cho cổng quản trị.

Access chỉ đứng trước ``/admin*`` và ``/api/admin/*``, còn đăng nhập/làm mới
phiên admin đi qua ``/api/auth/*`` (dùng chung với ứng viên/NTD). Sau khi qua
Access, trình duyệt giữ cookie ``CF_Authorization`` (JWT do Cloudflare ký) cho
cả domain, nên ở đây đòi JWT đó trước khi phát token cho tài khoản admin: lộ mật
khẩu admin thôi chưa đủ để đăng nhập từ ngoài Access.

Chỉ bật khi đã cấu hình ``CLOUDFLARE_ACCESS_TEAM_DOMAIN`` + ``CLOUDFLARE_ACCESS_AUD``
(dev/test/trước khi dựng Access thì bỏ qua). ``jwt`` là PyJWT, phụ thuộc của simplejwt.
"""

from functools import lru_cache

import jwt
from django.conf import settings
from django.utils.translation import gettext as _
from rest_framework.exceptions import PermissionDenied

ACCESS_HEADER = 'Cf-Access-Jwt-Assertion'
ACCESS_COOKIE = 'CF_Authorization'
# Khóa ký của Access xoay vòng định kỳ; PyJWKClient tự tải lại khi gặp kid lạ.
JWKS_LIFESPAN_SECONDS = 60 * 60


class CloudflareAccessRequired(PermissionDenied):
    default_code = 'cloudflare_access_required'


def is_enforced():
    return bool(settings.CLOUDFLARE_ACCESS_TEAM_DOMAIN and settings.CLOUDFLARE_ACCESS_AUD)


def _issuer():
    return f'https://{settings.CLOUDFLARE_ACCESS_TEAM_DOMAIN}'


@lru_cache(maxsize=1)
def _jwks_client(issuer):
    return jwt.PyJWKClient(
        f'{issuer}/cdn-cgi/access/certs', cache_keys=True, lifespan=JWKS_LIFESPAN_SECONDS
    )


def _signing_key(token):
    return _jwks_client(_issuer()).get_signing_key_from_jwt(token).key


def _token_from(request):
    return request.headers.get(ACCESS_HEADER) or request.COOKIES.get(ACCESS_COOKIE)


def require_access(request):
    """Raise 403 nếu request không mang phiên Cloudflare Access hợp lệ (khi đã bật)."""
    if not is_enforced():
        return
    denied = CloudflareAccessRequired(
        _('Cần xác thực Cloudflare Access trước khi đăng nhập trang quản trị.')
    )
    token = _token_from(request) if request is not None else None
    if not token:
        raise denied
    try:
        jwt.decode(
            token,
            _signing_key(token),
            algorithms=['RS256'],
            audience=settings.CLOUDFLARE_ACCESS_AUD,
            issuer=_issuer(),
            options={'require': ['exp', 'iat', 'iss', 'aud']},
        )
    except (jwt.PyJWTError, OSError) as error:
        # PyJWKClientError khi không tải được khóa cũng là PyJWTError: fail-closed.
        raise denied from error

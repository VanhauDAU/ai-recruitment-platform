"""Social login qua OAuth Authorization Code Flow (backend callback).

Luồng: frontend mở `/auth/oauth/<provider>/start/` → redirect sang provider →
provider gọi lại `/auth/oauth/<provider>/callback/` → backend verify state,
đổi code lấy access token, đọc profile, tạo/liên kết user → phát `one_time_code`
(Redis TTL ngắn) → redirect về trang callback frontend → frontend POST
`/auth/oauth/complete/` đổi code lấy JWT.

State + one_time_code đều lưu Redis (cache mặc định) tự hết hạn — không cần bảng.
"""

import secrets
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.core.cache import cache
from django.db import transaction

from .models import SocialAccount, User

_STATE_PREFIX = 'oauth:state:'
_CODE_PREFIX = 'oauth:code:'

# Provider hợp lệ theo cổng: ứng viên đủ 3, nhà tuyển dụng chỉ Google, admin không có.
PORTAL_PROVIDERS = {
    'main': ('google', 'facebook', 'linkedin'),
    'employer': ('google',),
}
PORTAL_ROLE = {
    'main': User.Role.CANDIDATE,
    'employer': User.Role.EMPLOYER,
}


class OAuthError(Exception):
    """Lỗi trong luồng OAuth, mang `code` máy-đọc để frontend hiển thị thông báo."""

    def __init__(self, code):
        self.code = code
        super().__init__(code)


def _providers():
    fb_version = settings.OAUTH_FACEBOOK_GRAPH_VERSION
    return {
        'google': {
            'client_id': settings.OAUTH_GOOGLE_CLIENT_ID,
            'client_secret': settings.OAUTH_GOOGLE_CLIENT_SECRET,
            'authorize_url': 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_url': 'https://oauth2.googleapis.com/token',
            'userinfo_url': 'https://openidconnect.googleapis.com/v1/userinfo',
            'scope': 'openid email profile',
        },
        'facebook': {
            'client_id': settings.OAUTH_FACEBOOK_CLIENT_ID,
            'client_secret': settings.OAUTH_FACEBOOK_CLIENT_SECRET,
            'authorize_url': f'https://www.facebook.com/{fb_version}/dialog/oauth',
            'token_url': f'https://graph.facebook.com/{fb_version}/oauth/access_token',
            'userinfo_url': f'https://graph.facebook.com/{fb_version}/me',
            'scope': 'email public_profile',
        },
        'linkedin': {
            # LinkedIn OIDC ("Sign In with LinkedIn using OpenID Connect")
            'client_id': settings.OAUTH_LINKEDIN_CLIENT_ID,
            'client_secret': settings.OAUTH_LINKEDIN_CLIENT_SECRET,
            'authorize_url': 'https://www.linkedin.com/oauth/v2/authorization',
            'token_url': 'https://www.linkedin.com/oauth/v2/accessToken',
            'userinfo_url': 'https://api.linkedin.com/v2/userinfo',
            'scope': 'openid profile email',
        },
    }


def provider_config(provider):
    cfg = _providers().get(provider)
    if cfg is None:
        raise OAuthError('unknown_provider')
    if not cfg['client_id'] or not cfg['client_secret']:
        raise OAuthError('provider_not_configured')
    return cfg


def frontend_callback_url(portal):
    if portal == 'employer':
        return settings.OAUTH_EMPLOYER_CALLBACK_URL
    return settings.OAUTH_MAIN_CALLBACK_URL


def safe_next(next_path):
    """Chỉ chấp nhận path nội bộ ('/...'), chặn absolute/protocol-relative URL."""
    if isinstance(next_path, str) and next_path.startswith('/') and not next_path.startswith('//'):
        return next_path
    return ''


# ---- State (chống CSRF) + one_time_code (đổi JWT), đều one-shot qua Redis ----

def create_state(provider, portal, next_path):
    state = secrets.token_urlsafe(32)
    cache.set(
        f'{_STATE_PREFIX}{state}',
        {'provider': provider, 'portal': portal, 'next': next_path},
        settings.OAUTH_STATE_TTL,
    )
    return state


def pop_state(state):
    if not state:
        return None
    key = f'{_STATE_PREFIX}{state}'
    data = cache.get(key)
    if data is not None:
        cache.delete(key)
    return data


def create_one_time_code(user):
    code = secrets.token_urlsafe(32)
    cache.set(f'{_CODE_PREFIX}{code}', user.pk, settings.OAUTH_CODE_TTL)
    return code


def pop_one_time_code(code):
    if not code:
        return None
    key = f'{_CODE_PREFIX}{code}'
    user_id = cache.get(key)
    if user_id is not None:
        cache.delete(key)
    return user_id


# ---- Nói chuyện với provider ----

def build_authorize_url(provider, redirect_uri, state):
    cfg = provider_config(provider)
    params = {
        'client_id': cfg['client_id'],
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': cfg['scope'],
        'state': state,
    }
    return f"{cfg['authorize_url']}?{urlencode(params)}"


def exchange_code(provider, code, redirect_uri):
    """Đổi authorization code lấy access token của provider."""
    cfg = provider_config(provider)
    try:
        resp = requests.post(
            cfg['token_url'],
            data={
                'client_id': cfg['client_id'],
                'client_secret': cfg['client_secret'],
                'code': code,
                'grant_type': 'authorization_code',
                'redirect_uri': redirect_uri,
            },
            timeout=10,
        )
        resp.raise_for_status()
        token = resp.json().get('access_token')
    except requests.RequestException as exc:
        raise OAuthError('exchange_failed') from exc
    if not token:
        raise OAuthError('exchange_failed')
    return token


def fetch_profile(provider, access_token):
    """Đọc + chuẩn hoá profile: {'id', 'email', 'name', 'avatar', 'raw'}."""
    cfg = provider_config(provider)
    try:
        if provider == 'facebook':
            resp = requests.get(
                cfg['userinfo_url'],
                params={'fields': 'id,name,email,picture.type(large)', 'access_token': access_token},
                timeout=10,
            )
        else:
            resp = requests.get(
                cfg['userinfo_url'],
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=10,
            )
        resp.raise_for_status()
        raw = resp.json()
    except requests.RequestException as exc:
        raise OAuthError('profile_failed') from exc

    if provider == 'facebook':
        avatar = (raw.get('picture') or {}).get('data', {}).get('url', '')
        profile = {'id': raw.get('id'), 'email': raw.get('email'), 'name': raw.get('name', ''), 'avatar': avatar}
    else:  # google + linkedin đều theo chuẩn OIDC userinfo
        profile = {'id': raw.get('sub'), 'email': raw.get('email'), 'name': raw.get('name', ''), 'avatar': raw.get('picture', '')}

    if not profile['id']:
        raise OAuthError('profile_failed')
    profile['raw'] = raw
    return profile


# ---- Tạo / liên kết user ----

def resolve_user(provider, profile, portal):
    """Tìm hoặc tạo user cho danh tính social, theo luật cổng.

    - Đã có SocialAccount -> dùng user đó (sai role cổng thì chặn).
    - Email trùng user hiện có cùng role -> tự liên kết.
    - Email trùng khác role -> chặn 'wrong_portal'.
    - Chưa có -> tạo user mới: role theo cổng, email_verified=True, password unusable.
    """
    role = PORTAL_ROLE[portal]

    with transaction.atomic():
        account = (
            SocialAccount.objects.select_related('user')
            .filter(provider=provider, provider_user_id=profile['id'])
            .first()
        )
        if account:
            user = account.user
            if user.role != role:
                raise OAuthError('wrong_portal')
            if not user.is_active:
                raise OAuthError('inactive')
            return user

        email = User.objects.normalize_email(profile.get('email') or '')
        if not email:
            raise OAuthError('no_email')

        user = User.objects.filter(email__iexact=email).first()
        if user:
            if user.role != role:
                raise OAuthError('wrong_portal')
            if not user.is_active:
                raise OAuthError('inactive')
            # Provider đã xác thực email này -> coi như email tài khoản đã xác thực.
            update_fields = []
            if not user.email_verified:
                user.email_verified = True
                update_fields.append('email_verified')
            if not user.avatar_url and profile.get('avatar'):
                user.avatar_url = profile['avatar']
                update_fields.append('avatar_url')
            if update_fields:
                user.save(update_fields=[*update_fields, 'updated_at'])
        else:
            user = User.objects.create_user(
                email=email,
                password=None,  # password unusable — chỉ đăng nhập qua social
                role=role,
                full_name=profile.get('name', ''),
                avatar_url=profile.get('avatar', ''),
                provider=provider,
                provider_id=profile['id'],
                email_verified=True,
            )

        SocialAccount.objects.create(
            user=user,
            provider=provider,
            provider_user_id=profile['id'],
            email=email,
            raw_profile=profile.get('raw', {}),
        )
        return user

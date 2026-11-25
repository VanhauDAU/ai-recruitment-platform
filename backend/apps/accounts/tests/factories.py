"""Fixture và hằng số dùng chung cho test suite của app accounts."""

import tempfile

from django.urls import reverse

from ..models import User
from ..services.refresh_cookies import cookie_name

# PNG 1x1 hợp lệ — dùng cho mọi test upload ảnh.
PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
    b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
    b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
    b'\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)
TEST_MEDIA_ROOT = tempfile.mkdtemp()

GOOGLE_PROFILE = {
    'id': 'google-uid-1',
    'email': 'social@example.com',
    'name': 'Nguyễn Social',
    'avatar': 'https://lh3.example.com/a.png',
    'email_verified': True,
    'raw': {'sub': 'google-uid-1', 'email_verified': True},
}


def oauth_state_for(client, provider='google', portal='main', next_path='', *, nonce=''):
    """State OAuth gắn với trình duyệt của ``client`` (như OAuthStartView làm)."""
    from ..services import oauth

    binding = oauth.new_browser_binding()
    client.cookies[oauth.OAUTH_BROWSER_COOKIE] = binding
    return oauth.create_state(provider, portal, next_path, binding, nonce=nonce)


def set_refresh_cookie(client, portal, refresh):
    client.cookies[cookie_name(portal)] = str(refresh)


def refresh_session(client, portal='main'):
    return client.post(reverse('auth-refresh'), {'portal': portal}, format='json')


def make_admin(email='admin@example.com', *, superuser=False, password='Password@123', **extra):
    """Tài khoản cổng quản trị (ADR-0018): superuser hoặc admin thường."""

    return User.objects.create_user(
        email,
        password,
        role=User.Role.ADMIN,
        is_superuser=superuser,
        is_staff=superuser,
        **extra,
    )

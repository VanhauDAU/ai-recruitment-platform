"""Fixture và hằng số dùng chung cho test suite của app accounts."""

import tempfile

from django.urls import reverse

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


def set_refresh_cookie(client, portal, refresh):
    client.cookies[cookie_name(portal)] = str(refresh)


def refresh_session(client, portal='main'):
    return client.post(reverse('auth-refresh'), {'portal': portal}, format='json')

"""Ngôn ngữ cho việc chạy ngoài request (email, Celery, thông báo) — ADR-0023.

Trong request, LocaleMiddleware chọn ngôn ngữ theo Accept-Language. Email và
thông báo gửi cho người khác phải theo ngôn ngữ của NGƯỜI NHẬN, không theo
người đang thao tác.
"""

from contextlib import contextmanager

from django.conf import settings
from django.utils import translation


def language_of(user):
    """``preferred_language`` của tài khoản; thiếu thì ngôn ngữ mặc định."""
    return getattr(user, 'preferred_language', None) or settings.LANGUAGE_CODE


@contextmanager
def recipient_language(user):
    with translation.override(language_of(user)):
        yield

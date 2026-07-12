"""Shared email delivery helpers for authentication workflows."""

from urllib.parse import urlencode

from django.conf import settings

from apps.sitecontent.selectors import get_string_setting
from common.email import send_html_email as send_email


def site_setting(key, default=''):
    return get_string_setting(key, default)


def from_email():
    """Display sender, preferring the name configured by an administrator."""
    name = site_setting('email_from_name', settings.EMAIL_FROM_NAME)
    return f'{name} <{settings.EMAIL_FROM_ADDRESS}>' if name else settings.EMAIL_FROM_ADDRESS


def frontend_link(path, *, base_url=None, **query):
    base = (base_url or settings.FRONTEND_URL).rstrip('/')
    suffix = f'?{urlencode(query)}' if query else ''
    return f'{base}{path}{suffix}'


def send_html_email(*, subject, text, html, to):
    support_email = site_setting('support_email', '')
    return send_email(
        subject=subject,
        text=text,
        html=html,
        from_email=from_email(),
        to=to,
        reply_to=support_email or None,
    )

"""Shared email delivery helpers for authentication workflows."""

from urllib.parse import urlencode

from django.conf import settings

from apps.sitecontent.selectors import email_sender
from common.email import send_html_email as send_email


def frontend_link(path, *, base_url=None, **query):
    base = (base_url or settings.FRONTEND_URL).rstrip('/')
    suffix = f'?{urlencode(query)}' if query else ''
    return f'{base}{path}{suffix}'


def send_html_email(*, subject, text, html, to):
    return send_email(subject=subject, text=text, html=html, to=to, **email_sender())

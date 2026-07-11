"""Infrastructure-only email transport."""

from .backend import send_html_email

__all__ = ['send_html_email']

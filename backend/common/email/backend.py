"""Generic HTML email transport with no business-app dependencies."""

from django.conf import settings
from django.core.mail import EmailMultiAlternatives


def send_html_email(*, subject, text, html, to, from_email=None, reply_to=None):
    message = EmailMultiAlternatives(
        subject=subject,
        body=text,
        from_email=from_email or settings.DEFAULT_FROM_EMAIL,
        to=[to],
        reply_to=[reply_to] if reply_to else None,
    )
    message.attach_alternative(html, 'text/html')
    message.send(fail_silently=False)

"""Generic HTML email transport with no business-app dependencies."""

from django.conf import settings
from django.core.mail import EmailMultiAlternatives


def send_html_email(
    *, subject, text, html, to, from_email=None, reply_to=None, headers=None, attachments=None
):
    """``attachments``: các bộ ``(tên tệp, nội dung, MIME)``, vd lịch .ics."""
    message = EmailMultiAlternatives(
        subject=subject,
        body=text,
        from_email=from_email or settings.DEFAULT_FROM_EMAIL,
        to=[to],
        reply_to=[reply_to] if reply_to else None,
        headers=headers,
    )
    message.attach_alternative(html, 'text/html')
    for attachment in attachments or ():
        message.attach(*attachment)
    message.send(fail_silently=False)

"""Dọn dữ liệu xác thực đã hết vai trò (beat chạy hằng ngày, xem tasks.maintenance).

- Blacklist/outstanding token của SimpleJWT quá hạn: lệnh ``flushexpiredtokens``.
- Session Django hết hạn (admin Django, OAuth state): lệnh ``clearsessions``.
- ``AuthSession`` đã kết thúc (thu hồi hoặc hết hạn) quá ``AUTH_SESSION_RETENTION_DAYS``.
- Outbox ``AuthEmailJob`` đã xong (gửi/hủy/thất bại) quá ``AUTH_EMAIL_JOB_RETENTION_DAYS``.
"""

from datetime import timedelta

from django.conf import settings
from django.core.management import call_command
from django.db.models import Q
from django.utils import timezone

from ..models import AuthEmailJob, AuthSession


def flush_expired_jwt_tokens():
    call_command('flushexpiredtokens', verbosity=0)


def clear_expired_django_sessions():
    call_command('clearsessions', verbosity=0)


def purge_ended_auth_sessions(*, now=None):
    """Xóa phiên đã kết thúc từ lâu; trả số phiên đã xóa.

    Giữ phiên còn được bằng chứng chấp nhận DPA của NTD tham chiếu: FK là
    ``SET_NULL`` nên xóa sẽ cắt mất liên kết phiên của bằng chứng đó.
    """
    cutoff = (now or timezone.now()) - timedelta(days=settings.AUTH_SESSION_RETENTION_DAYS)
    deleted, _ = (
        AuthSession.objects.filter(Q(revoked_at__lt=cutoff) | Q(expires_at__lt=cutoff))
        .filter(employer_dpa_acceptances__isnull=True)
        .delete()
    )
    return deleted


def purge_finished_auth_email_jobs(*, now=None):
    """Xóa job email xác thực đã xong (context chứa email người nhận); trả số job đã xóa.

    Job chào mừng giữ lại: ràng buộc một welcome/tài khoản là thứ chặn gửi lặp khi
    người dùng xác thực lại hoặc đăng nhập OAuth lần nữa.
    """
    cutoff = (now or timezone.now()) - timedelta(days=settings.AUTH_EMAIL_JOB_RETENTION_DAYS)
    deleted, _ = (
        AuthEmailJob.objects.filter(
            status__in=[
                AuthEmailJob.Status.SENT,
                AuthEmailJob.Status.CANCELLED,
                AuthEmailJob.Status.FAILED,
            ],
            updated_at__lt=cutoff,
        )
        .exclude(kind=AuthEmailJob.Kind.WELCOME)
        .delete()
    )
    return deleted

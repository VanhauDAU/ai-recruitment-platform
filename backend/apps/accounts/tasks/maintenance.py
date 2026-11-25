"""Task beat hằng ngày dọn token, session và outbox xác thực đã hết hạn (queue ``default``)."""

import logging

from celery import shared_task

from ..services import retention

logger = logging.getLogger(__name__)


@shared_task
def flush_expired_jwt_tokens():
    retention.flush_expired_jwt_tokens()


@shared_task
def clear_expired_django_sessions():
    retention.clear_expired_django_sessions()


@shared_task
def purge_ended_auth_sessions():
    deleted = retention.purge_ended_auth_sessions()
    logger.info('Đã xóa %s phiên đăng nhập đã kết thúc.', deleted)
    return deleted


@shared_task
def purge_finished_auth_email_jobs():
    deleted = retention.purge_finished_auth_email_jobs()
    logger.info('Đã xóa %s auth email job đã xong.', deleted)
    return deleted

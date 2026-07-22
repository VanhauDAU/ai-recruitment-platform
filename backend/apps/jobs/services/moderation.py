"""Administrative moderation workflows for submitted job postings."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import Job, JobStatusHistory
from .posting import _record_status


@transaction.atomic
def approve_job(*, job, user):
    """Make one pending job public after an administrator approves it."""
    if job.status != Job.Status.PENDING:
        raise ValidationError('Chỉ có thể duyệt tin đang chờ duyệt.')

    now = timezone.now()
    job.status = Job.Status.ACTIVE
    job.approved_at = now
    job.published_at = now
    job.rejected_reason = ''
    job.save(
        update_fields=['status', 'approved_at', 'published_at', 'rejected_reason', 'updated_at']
    )
    _record_status(
        job,
        from_status=Job.Status.PENDING,
        to_status=Job.Status.ACTIVE,
        user=user,
        actor_role=JobStatusHistory.ActorRole.ADMIN,
    )
    return job


@transaction.atomic
def reject_job(*, job, user, reason):
    """Reject one pending job with a mandatory, employer-visible explanation."""
    if job.status != Job.Status.PENDING:
        raise ValidationError('Chỉ có thể từ chối tin đang chờ duyệt.')
    reason = reason.strip()
    if not reason:
        raise ValidationError(
            {'reason': 'Nhập lý do từ chối để nhà tuyển dụng có thể chỉnh sửa tin.'}
        )

    job.status = Job.Status.REJECTED
    job.approved_at = None
    job.published_at = None
    job.rejected_reason = reason
    job.save(
        update_fields=['status', 'approved_at', 'published_at', 'rejected_reason', 'updated_at']
    )
    _record_status(
        job,
        from_status=Job.Status.PENDING,
        to_status=Job.Status.REJECTED,
        user=user,
        note=reason,
        actor_role=JobStatusHistory.ActorRole.ADMIN,
    )
    return job

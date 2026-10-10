"""Frequency-capped delivery evidence for saved-job remarketing."""

from datetime import timedelta
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.jobs.models import SavedJob
from apps.jobs.services import job_is_publicly_available
from common.metrics import record_metric

from ..models import (
    JobServiceActivation,
    SavedJobRemarketingImpression,
    ServiceCapability,
)

VIETNAM_TZ = ZoneInfo('Asia/Ho_Chi_Minh')


@transaction.atomic
def record_saved_job_remarketing_impression(
    *,
    candidate,
    job_public_id,
    activation_public_id,
    at=None,
):
    """Record at most once/day and three times/rolling seven days."""
    at = at or timezone.now()
    saved = (
        SavedJob.objects.select_for_update()
        .select_related('job')
        .filter(candidate=candidate, job__public_id=job_public_id)
        .first()
    )
    if saved is None:
        raise ValidationError('Tin không còn trong danh sách đã lưu.')
    if saved.job.applications.filter(candidate=candidate).exists():
        raise ValidationError('Tin đã được ứng tuyển và không còn đủ điều kiện hiển thị lại.')
    if not job_is_publicly_available(job_id=saved.job_id):
        raise ValidationError('Tin không còn công khai.')

    eligible_activation_id = (
        JobServiceActivation.objects.filter(
            public_id=activation_public_id,
            job_id=saved.job_id,
            status=JobServiceActivation.Status.ACTIVE,
            starts_at__lte=at,
            ends_at__gt=at,
            items__capability__code=ServiceCapability.Code.SAVED_REMARKETING,
            items__starts_at__lte=at,
            items__ends_at__gt=at,
        )
        .values_list('pk', flat=True)
        .first()
    )
    if eligible_activation_id is None:
        raise ValidationError('Dịch vụ remarketing không còn hiệu lực.')
    activation = JobServiceActivation.objects.select_for_update().get(pk=eligible_activation_id)

    shown_on = timezone.localdate(at, timezone=VIETNAM_TZ)
    existing = SavedJobRemarketingImpression.objects.filter(
        candidate=candidate,
        job=saved.job,
        shown_on=shown_on,
    ).first()
    if existing:
        return existing, False
    recent_count = SavedJobRemarketingImpression.objects.filter(
        candidate=candidate,
        job=saved.job,
        shown_at__gte=at - timedelta(days=7),
    ).count()
    if recent_count >= 3:
        raise ValidationError('Tin đã đạt giới hạn hiển thị lại trong 7 ngày.')
    impression = SavedJobRemarketingImpression.objects.create(
        candidate=candidate,
        activation=activation,
        job=saved.job,
        shown_on=shown_on,
        shown_at=at,
    )
    record_metric('saved_job_remarketing', event='impression', status='counted')
    return impression, True


def delete_candidate_saved_remarketing_history(*, candidate):
    deleted, _ = SavedJobRemarketingImpression.objects.filter(candidate=candidate).delete()
    return deleted


def purge_saved_job_remarketing_history(*, at=None, retention_days=None):
    from django.conf import settings

    at = at or timezone.now()
    retention_days = retention_days or settings.SAVED_JOB_REMARKETING_RETENTION_DAYS
    deleted, _ = SavedJobRemarketingImpression.objects.filter(
        shown_at__lt=at - timedelta(days=retention_days)
    ).delete()
    return deleted

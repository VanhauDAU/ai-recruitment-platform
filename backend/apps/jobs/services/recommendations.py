"""Candidate commands for controlling personalized job recommendations."""

from django.db import transaction

from ..models import CandidateHiddenJob, Job
from ..models.querysets import publicly_available_job_filter


@transaction.atomic
def hide_recommended_job(*, candidate, job_public_id, source):
    """Idempotently dismiss one job from this candidate's personalized lanes."""
    job = (
        Job.objects.filter(publicly_available_job_filter(), public_id=job_public_id)
        .distinct()
        .get()
    )
    hidden, _ = CandidateHiddenJob.objects.get_or_create(
        candidate=candidate,
        job=job,
        defaults={'source': source},
    )
    return hidden


@transaction.atomic
def restore_recommended_job(*, candidate, job_public_id):
    """Idempotently undo only the requesting candidate's dismissal."""
    deleted, _ = CandidateHiddenJob.objects.filter(
        candidate=candidate,
        job__public_id=job_public_id,
    ).delete()
    return bool(deleted)

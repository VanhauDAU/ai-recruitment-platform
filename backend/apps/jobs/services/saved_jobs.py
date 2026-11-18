"""Candidate saves a job; saving twice keeps the first row."""

from ..models import SavedJob


def save_job_for_candidate(*, candidate, job):
    saved_job, _ = SavedJob.objects.get_or_create(candidate=candidate, job=job)
    return saved_job

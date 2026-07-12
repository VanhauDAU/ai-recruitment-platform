"""Job engagement write use cases."""

from django.db.models import F

from ..models import Job


def record_job_view(job):
    """Atomically increment a job's public view count and refresh the instance."""
    Job.objects.filter(pk=job.pk).update(view_count=F('view_count') + 1)
    job.refresh_from_db(fields=['view_count'])
    return job

from ..models import Job
from ..models.querysets import publicly_available_job_filter


def job_is_publicly_available(*, job_id):
    """Expose the canonical candidate-visibility decision to other domains."""
    return Job.objects.filter(publicly_available_job_filter(), pk=job_id).exists()

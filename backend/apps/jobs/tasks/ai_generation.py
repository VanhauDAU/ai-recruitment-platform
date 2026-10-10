import logging

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from ..services import (
    execute_job_ai_generation,
    fail_job_ai_generation,
    purge_job_ai_generation_content,
    recover_stale_job_ai_generations,
)

logger = logging.getLogger(__name__)


@shared_task(
    name='apps.jobs.tasks.ai_generation.generate_job_post',
    soft_time_limit=85,
    time_limit=90,
)
def generate_job_post(generation_id):
    try:
        return execute_job_ai_generation(generation_id)
    except SoftTimeLimitExceeded:
        fail_job_ai_generation(generation_id, code='generation_timeout')
        return None


@shared_task(name='apps.jobs.tasks.ai_generation.recover_stale_job_generations')
def recover_stale_job_generations():
    generation_ids = recover_stale_job_ai_generations()
    for generation_id in generation_ids:
        try:
            generate_job_post.delay(generation_id)
        except Exception:  # noqa: BLE001 - leave queued for the next recovery sweep
            logger.exception('Không thể redispatch job AI generation %s.', generation_id)
    return len(generation_ids)


@shared_task(name='apps.jobs.tasks.ai_generation.purge_job_generation_content')
def purge_job_generation_content():
    return purge_job_ai_generation_content()

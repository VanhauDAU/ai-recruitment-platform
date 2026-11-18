"""Task của queue `ai-matching`, chạy trong service `ml-worker` (image có torch).

Mô hình được nạp một lần khi tiến trình worker khởi động (biến môi trường
`MATCHING_PRELOAD_MODEL=1` chỉ đặt cho ml-worker), nên lượt phân tích đầu tiên
không phải chờ nạp mô hình.
"""

import logging
import os

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from celery.signals import worker_process_init

from apps.cvs.models import CvVersion

from ..selectors import analysis_for_run, jobs_for_profile
from ..services import (
    SkillCatalog,
    ensure_cv_document,
    ensure_job_document,
    execute_analysis,
    fail_analysis,
    get_encoder,
)
from ..services import (
    recover_stale_analyses as find_stale_analyses,
)

logger = logging.getLogger(__name__)


@worker_process_init.connect
def preload_model(**kwargs):
    if os.environ.get('MATCHING_PRELOAD_MODEL') == '1':
        get_encoder()


@shared_task(name='apps.matching.tasks.run_analysis', soft_time_limit=25, time_limit=30)
def run_analysis(analysis_id):
    analysis = analysis_for_run(analysis_id)
    if analysis is None:
        return None
    job = jobs_for_profile(statuses=None).filter(pk=analysis.job_id).first()
    try:
        execute_analysis(analysis_id, job=job, encoder=get_encoder(), catalog=SkillCatalog.load())
    except SoftTimeLimitExceeded:
        fail_analysis(analysis_id, 'analysis_timeout')
    return analysis_id


@shared_task(name='apps.matching.tasks.embed_cv_version', soft_time_limit=25, time_limit=30)
def embed_cv_version(cv_version_id):
    """Tính sẵn vector cho phiên bản mới nhất của một CV."""
    version = (
        CvVersion.objects.select_related('cv')
        .filter(pk=cv_version_id, cv__latest_version_id=cv_version_id)
        .first()
    )
    if version is not None:
        ensure_cv_document(version, encoder=get_encoder(), catalog=SkillCatalog.load())


@shared_task(name='apps.matching.tasks.embed_job', soft_time_limit=25, time_limit=30)
def embed_job(job_id):
    """Tính sẵn vector cho một tin đang mở."""
    job = jobs_for_profile().filter(pk=job_id).first()
    if job is not None:
        ensure_job_document(job, encoder=get_encoder())


@shared_task(name='apps.matching.tasks.recover_stale_analyses')
def recover_stale_analyses():
    analysis_ids = find_stale_analyses()
    for analysis_id in analysis_ids:
        try:
            run_analysis.delay(analysis_id)
        except Exception:  # noqa: BLE001 - để lại hàng chờ cho lượt quét sau
            logger.exception('Không thể gửi lại phân tích %s.', analysis_id)
    return len(analysis_ids)

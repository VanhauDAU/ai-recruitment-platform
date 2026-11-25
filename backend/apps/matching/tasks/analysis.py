"""Task đối sánh, chạy trong service `ml-worker` (image có torch).

Hai queue trên cùng một worker: `ai-matching` cho lượt có người đang đợi (ứng viên
bấm "Xem độ phù hợp") và việc tính sẵn vector; `ai-matching-batch` cho việc nền là
chấm hồ sơ ứng tuyển (`score_application`, `rescore_job_applications`). Worker lấy
luân phiên giữa hai queue, nên một loạt hồ sơ nền không chặn lượt tương tác.

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

from ..models import analysis_for_run, jobs_for_profile
from ..services import (
    SkillCatalog,
    application_ranking_enabled,
    applications_needing_score,
    ensure_cv_document,
    ensure_job_document,
    execute_analysis,
    fail_analysis,
    fail_application_score,
    get_encoder,
    stale_application_ids,
)
from ..services import (
    recover_stale_analyses as find_stale_analyses,
)
from ..services import (
    score_application as run_application_score,
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
    """Tính sẵn vector cho một tin đang mở; tin đổi nội dung thì chấm lại hồ sơ của tin."""
    job = jobs_for_profile().filter(pk=job_id).first()
    if job is None:
        return
    document = ensure_job_document(job, encoder=get_encoder())
    if application_ranking_enabled():
        _enqueue_scores(applications_needing_score(job, document.content_hash))


def _enqueue_scores(application_ids):
    for application_id in application_ids:
        try:
            score_application.delay(application_id)
        except Exception:  # noqa: BLE001 - lượt quét sau hoặc lệnh backfill sẽ gửi lại
            logger.exception('Không thể gửi task chấm hồ sơ %s.', application_id)


@shared_task(name='apps.matching.tasks.score_application', soft_time_limit=25, time_limit=30)
def score_application(application_id):
    """Chấm bản CV đã nộp của một hồ sơ ứng tuyển (queue `ai-matching-batch`)."""
    try:
        run_application_score(application_id, encoder=get_encoder(), catalog=SkillCatalog.load())
    except SoftTimeLimitExceeded:
        fail_application_score(application_id, 'analysis_timeout')
    return application_id


@shared_task(name='apps.matching.tasks.rescore_job_applications')
def rescore_job_applications(job_id):
    """Gửi task chấm cho mọi hồ sơ của một tin chưa có kết quả với nội dung tin hiện tại."""
    job = jobs_for_profile(statuses=None).filter(pk=job_id).first()
    if job is None or not application_ranking_enabled():
        return 0
    application_ids = applications_needing_score(job)
    _enqueue_scores(application_ids)
    return len(application_ids)


@shared_task(name='apps.matching.tasks.recover_stale_analyses')
def recover_stale_analyses():
    analysis_ids = find_stale_analyses()
    for analysis_id in analysis_ids:
        try:
            run_analysis.delay(analysis_id)
        except Exception:  # noqa: BLE001 - để lại hàng chờ cho lượt quét sau
            logger.exception('Không thể gửi lại phân tích %s.', analysis_id)
    if application_ranking_enabled():
        _enqueue_scores(stale_application_ids())
    return len(analysis_ids)

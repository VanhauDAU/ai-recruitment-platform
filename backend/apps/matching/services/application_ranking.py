"""Chấm mức phù hợp của hồ sơ ứng tuyển để nhà tuyển dụng xếp hạng.

Khác lượt ứng viên tự xem ở ba điểm:
- **Chỉ chấm hồ sơ ứng viên đồng ý** (`Application.allow_ai_analysis`) và chỉ hồ sơ
  hiện hành (bản bị nộp lại thay thế là lịch sử).
- **Chấm đúng bản CV đã nộp** (`submitted_cv_version`), không phải CV hiện tại trong
  thư viện của ứng viên.
- **Chạy nền** ở queue `ai-matching-batch`: không ai đợi từng kết quả, nên không có
  hạn chờ. Hàng `MatchAnalysis` được tạo ngay trong task, vì vậy hồ sơ chưa tới
  lượt đơn giản là chưa có hàng ("đang phân tích" ở giao diện).

Kết quả lưu ở `MatchAnalysis` với `purpose = application_ranking`. Điểm chỉ để nhà
tuyển dụng sắp xếp và tham khảo: không nơi nào đổi trạng thái hồ sơ theo điểm
(`apps.applications.services.automatic_rejection` không đọc gì từ app này).
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone

from apps.applications.models import Application
from apps.sitecontent.selectors import get_bool_setting

from ..domain import APPLICATION_RANKING_FLAG, EXTRACTOR_VERSION, scoring_cache_version
from ..models import MatchAnalysis, MatchDocument, jobs_for_profile
from .analyses import execute_analysis, reset_failed_analysis
from .documents import job_document_hash
from .encoder import model_version

# Hàng xếp hạng kẹt ở `queued` (worker chết giữa chừng) được gửi lại sau khoảng này.
REDISPATCH_AFTER = timedelta(minutes=5)
RANKING = MatchAnalysis.Purpose.APPLICATION_RANKING


def application_ranking_enabled():
    return get_bool_setting(APPLICATION_RANKING_FLAG, default=False)


def _eligible_applications():
    return Application.objects.filter(
        allow_ai_analysis=True, is_current=True, submitted_cv_version__isnull=False
    )


def _analysis_for(application, digest):
    """Hàng phân tích của hồ sơ với nội dung tin hiện tại; hàng thất bại được đặt lại."""
    with transaction.atomic():
        analysis, _created = MatchAnalysis.objects.select_for_update().get_or_create(
            cv_version=application.submitted_cv_version,
            job_id=application.job_id,
            job_content_hash=digest,
            model_version=model_version(),
            scoring_version=scoring_cache_version(),
            defaults={'user_id': application.candidate_id, 'purpose': RANKING},
        )
        if analysis.status == MatchAnalysis.Status.FAILED:
            reset_failed_analysis(analysis)
    return analysis


def score_application(application_id, *, encoder, catalog, reranker=None):
    """Chấm bản CV đã nộp của một hồ sơ với tin của nó.

    Trả `MatchAnalysis`, hoặc None khi hồ sơ không được chấm (tính năng tắt, ứng viên
    không đồng ý, hồ sơ đã bị thay thế). Gọi lại với cùng đầu vào thì dùng kết quả cũ.
    """
    if not application_ranking_enabled():
        return None
    application = (
        _eligible_applications()
        .select_related('submitted_cv_version__cv')
        .filter(pk=application_id)
        .first()
    )
    if application is None:
        return None
    job = jobs_for_profile(statuses=None).filter(pk=application.job_id).first()
    analysis = _analysis_for(application, job_document_hash(job))
    if analysis.status != MatchAnalysis.Status.SUCCEEDED:
        execute_analysis(analysis.pk, job=job, encoder=encoder, catalog=catalog, reranker=reranker)
        analysis.refresh_from_db()
    return analysis


def fail_application_score(application_id, code):
    """Kết thúc hàng đang dở của một hồ sơ (task quá giờ) để nó không kẹt ở `processing`."""
    application = _eligible_applications().filter(pk=application_id).first()
    if application is None:
        return
    MatchAnalysis.objects.filter(
        cv_version_id=application.submitted_cv_version_id,
        job_id=application.job_id,
        purpose=RANKING,
        status__in=[MatchAnalysis.Status.QUEUED, MatchAnalysis.Status.PROCESSING],
    ).update(status=MatchAnalysis.Status.FAILED, error_code=code, completed_at=timezone.now())


def applications_needing_score(job, digest=None):
    """Id các hồ sơ được chấm của một tin mà chưa có kết quả cho nội dung tin hiện tại.

    Dùng khi tin đổi nội dung và khi backfill. `job` nạp bằng `jobs_for_profile`.
    """
    scored = MatchAnalysis.objects.filter(
        cv_version_id=OuterRef('submitted_cv_version_id'),
        job_id=OuterRef('job_id'),
        job_content_hash=digest or job_document_hash(job),
        model_version=model_version(),
        scoring_version=scoring_cache_version(),
        purpose=RANKING,
    )
    return list(
        _eligible_applications()
        .filter(job=job)
        .exclude(Exists(scored))
        .order_by('pk')
        .values_list('pk', flat=True)
    )


def snapshots_missing_profile():
    """Bản CV đã nộp của các hồ sơ được chấm mà chưa có hồ sơ trích xuất ở phiên bản hiện hành.

    Xảy ra sau khi đổi bộ trích xuất: điểm cũ vẫn còn nhưng "Hồ sơ trích xuất" của hồ sơ
    ứng tuyển cần được dựng lại.
    """
    current = MatchDocument.objects.filter(
        kind=MatchDocument.Kind.CV,
        cv_version_id=OuterRef('submitted_cv_version_id'),
        extractor_version=EXTRACTOR_VERSION,
        model_version=model_version(),
    )
    return [
        application.submitted_cv_version
        for application in _eligible_applications()
        .exclude(Exists(current))
        .select_related('submitted_cv_version__cv')
        .order_by('pk')
    ]


def jobs_with_rankable_applications():
    """Tin có ít nhất một hồ sơ được chấm (mọi trạng thái tin), cho lệnh backfill."""
    job_ids = _eligible_applications().values('job_id')
    return jobs_for_profile(statuses=None).filter(pk__in=job_ids)


def stale_application_ids(*, now=None, batch_size=100):
    """Id các hồ sơ có hàng xếp hạng kẹt ở hàng chờ, để gửi lại task."""
    now = now or timezone.now()
    stuck = MatchAnalysis.objects.filter(
        cv_version_id=OuterRef('submitted_cv_version_id'),
        job_id=OuterRef('job_id'),
        purpose=RANKING,
        status=MatchAnalysis.Status.QUEUED,
        created_at__lte=now - REDISPATCH_AFTER,
    )
    return list(
        _eligible_applications()
        .filter(Exists(stuck))
        .order_by('pk')
        .values_list('pk', flat=True)[:batch_size]
    )

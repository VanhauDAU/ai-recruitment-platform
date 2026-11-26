"""Vòng đời một lần phân tích độ phù hợp (`MatchAnalysis`).

1. `request_analysis` (web): kiểm tra cờ `ai_job_match_enabled`, tính khóa cache
   (phiên bản CV, tin, hash nội dung tin, phiên bản mô hình, phiên bản công thức).
   Trùng khóa và đã có kết quả thì trả ngay; chưa có thì tạo hàng `queued` và
   xếp task `run_analysis` sau khi commit.
2. `execute_analysis` (ml-worker): lấy quyền xử lý hàng, tạo/dùng lại tài liệu
   và vector của CV, tin, chấm điểm, giải thích, lưu kết quả.
3. `recover_stale_analyses` (beat mỗi 60 giây): gửi lại hàng chờ quá lâu, đưa
   hàng đang xử lý của worker đã chết về hàng chờ, cho hàng chờ quá hạn thất bại.
   Chấm điểm không gọi dịch vụ ngoài và cho cùng kết quả, nên chạy lại an toàn.

Hạn chờ 10 phút và việc gửi lại sau 30 giây chỉ áp cho lượt ứng viên tự xem
(`purpose = candidate_self`): có người đang đợi kết quả. Hàng xếp hạng hồ sơ cho
nhà tuyển dụng chạy nền ở queue `ai-matching-batch` (`application_ranking.py`),
không có hạn chờ.
"""

import logging
import time
from datetime import timedelta
from http import HTTPStatus

import numpy as np
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from apps.cvs.services import is_unsaved_builder_baseline
from apps.sitecontent.selectors import get_bool_setting

from ..domain import CANDIDATE_FIT_FLAG, FEATURE_FLAGS
from ..models import MatchAnalysis, MatchDocument
from .documents import chunk_vectors, ensure_cv_document, ensure_job_document, job_content_hash
from .encoder import model_version
from .explain import explain
from .extraction import EXTRACTOR_VERSION, ExtractionError
from .scoring import SCORING_VERSION, ScoringError, score_match

logger = logging.getLogger(__name__)

FEATURE_FLAG = CANDIDATE_FIT_FLAG
REDISPATCH_AFTER = timedelta(seconds=30)
STALE_PROCESSING_AFTER = timedelta(seconds=60)
QUEUED_TIMEOUT = timedelta(minutes=10)


class MatchingRequestError(APIException):
    """Lỗi có mã cố định (`feature_disabled`, `job_not_active`…) để giao diện hiển thị đúng."""

    MESSAGES = {
        'feature_disabled': (HTTPStatus.FORBIDDEN, 'Tính năng xem độ phù hợp đang tắt.'),
        'job_not_active': (HTTPStatus.NOT_FOUND, 'Tin tuyển dụng không còn mở.'),
        'cv_not_owned': (HTTPStatus.NOT_FOUND, 'Không tìm thấy CV của bạn.'),
        'cv_not_saved': (
            HTTPStatus.UNPROCESSABLE_ENTITY,
            'CV chưa được lưu lần nào. Hãy mở CV và bấm Lưu trước khi xem độ phù hợp.',
        ),
        'job_text_too_short': (
            HTTPStatus.UNPROCESSABLE_ENTITY,
            'Tin tuyển dụng không đủ nội dung để phân tích.',
        ),
    }

    def __init__(self, code):
        self.status_code, message = self.MESSAGES[code]
        self.machine_code = code
        super().__init__({'code': code, 'detail': message})


def matching_enabled():
    return get_bool_setting(FEATURE_FLAG, default=False)


def precompute_enabled():
    """Có chỗ dùng nào của đối sánh đang bật không (khi đó vector được tính sẵn)."""
    return any(get_bool_setting(flag, default=False) for flag in FEATURE_FLAGS)


def ensure_enabled():
    if not matching_enabled():
        raise MatchingRequestError('feature_disabled')


@transaction.atomic
def request_analysis(*, user, job, cv):
    """Phân tích cho cặp (CV, tin); hàng mới hoặc vừa đặt lại được xếp task sau commit.

    `job` nạp bằng selector `public_job_for_profile`, `cv` bằng `owner_cv_for_matching`.
    """
    ensure_enabled()
    if is_unsaved_builder_baseline(cv, cv.latest_version):
        raise MatchingRequestError('cv_not_saved')
    try:
        digest = job_content_hash(job)
    except ExtractionError as error:
        raise MatchingRequestError('job_text_too_short') from error
    analysis, created = MatchAnalysis.objects.select_for_update().get_or_create(
        cv_version=cv.latest_version,
        job=job,
        job_content_hash=digest,
        model_version=model_version(),
        scoring_version=SCORING_VERSION,
        defaults={'user': user},
    )
    if not created and analysis.status == MatchAnalysis.Status.FAILED:
        # Lỗi tạm (worker chết, quá hạn) có thể qua ở lần sau; lỗi do nội dung
        # (CV scan) sẽ thất bại lại ngay với cùng mã.
        reset_failed_analysis(analysis)
        created = True
    if created:
        _dispatch_after_commit(analysis.pk)
    return analysis


def _dispatch_after_commit(analysis_id):
    def dispatch():
        # Import tại chỗ: tasks phụ thuộc services, không theo chiều ngược lại.
        from ..tasks import run_analysis

        try:
            run_analysis.delay(analysis_id)
        except Exception:  # noqa: BLE001 - vòng phục hồi sẽ gửi lại hàng chờ
            logger.exception('Không thể gửi phân tích %s.', analysis_id)

    transaction.on_commit(dispatch)


def reset_failed_analysis(analysis):
    """Đưa một phân tích thất bại về hàng chờ như một yêu cầu mới (tính lại hạn chờ)."""
    values = {
        'status': MatchAnalysis.Status.QUEUED,
        'error_code': '',
        'started_at': None,
        'completed_at': None,
        'created_at': timezone.now(),
    }
    MatchAnalysis.objects.filter(pk=analysis.pk).update(**values)
    for field, value in values.items():
        setattr(analysis, field, value)


def _claim(analysis_id):
    with transaction.atomic():
        analysis = (
            MatchAnalysis.objects.select_for_update(skip_locked=True, of=('self',))
            .select_related('cv_version__cv')
            .filter(pk=analysis_id, status=MatchAnalysis.Status.QUEUED)
            .first()
        )
        if analysis is None:
            return None
        analysis.status = MatchAnalysis.Status.PROCESSING
        analysis.started_at = timezone.now()
        analysis.save(update_fields=['status', 'started_at'])
        return analysis


def _finish(analysis, *, status, latency_ms, result=None, error_code='', documents=(None, None)):
    analysis.status = status
    analysis.result_json = result or {}
    analysis.overall_score = result['overall']['score'] if result else None
    analysis.error_code = error_code
    analysis.latency_ms = latency_ms
    analysis.cv_document, analysis.job_document = documents
    analysis.completed_at = timezone.now()
    analysis.save(
        update_fields=[
            'status',
            'result_json',
            'overall_score',
            'error_code',
            'latency_ms',
            'cv_document',
            'job_document',
            'completed_at',
        ]
    )


def _vector(document):
    return None if document.embedding is None else np.asarray(document.embedding, dtype=np.float32)


def _chunks(document):
    chunks, vectors = chunk_vectors(document)
    return [{'section': chunk.section, 'text': chunk.text} for chunk in chunks], vectors


def execute_analysis(analysis_id, *, job, encoder, catalog):
    """Tính một phân tích đang chờ; trả hàng đã cập nhật, hoặc None nếu hàng không còn chờ."""
    analysis = _claim(analysis_id)
    if analysis is None:
        return None
    started = time.monotonic()
    documents = (None, None)
    try:
        cv_document = ensure_cv_document(analysis.cv_version, encoder=encoder, catalog=catalog)
        job_document = ensure_job_document(job, encoder=encoder)
        documents = (cv_document, job_document)
        for document in documents:
            if document.status == MatchDocument.Status.FAILED:
                raise ScoringError(document.error_code or 'document_failed')
        cv_chunks, cv_vectors = _chunks(cv_document)
        job_chunks, job_vectors = _chunks(job_document)
        result = explain(
            score_match(
                cv_document.profile_json,
                job_document.profile_json,
                cv_chunks=cv_chunks,
                cv_vectors=cv_vectors,
                job_chunks=job_chunks,
                job_vectors=job_vectors,
                cv_document_vector=_vector(cv_document),
                job_document_vector=_vector(job_document),
                model_version=encoder.version,
                catalog=catalog,
            )
        )
    except Exception as error:  # noqa: BLE001 - không để hàng kẹt ở `processing`
        if isinstance(error, ScoringError):
            code = error.code
        else:
            # Lỗi lập trình: chạy lại cũng hỏng, nên kết thúc hàng thay vì để vòng
            # phục hồi gửi lại mãi; chi tiết nằm trong log.
            logger.exception('Phân tích %s lỗi ngoài dự kiến.', analysis.public_id)
            code = 'internal_error'
        _finish(
            analysis,
            status=MatchAnalysis.Status.FAILED,
            error_code=code,
            latency_ms=round((time.monotonic() - started) * 1000),
            documents=documents,
        )
        return analysis
    latency_ms = round((time.monotonic() - started) * 1000)
    result['meta'] = {
        'model_version': encoder.version,
        'scoring_version': SCORING_VERSION,
        'extractor_version': EXTRACTOR_VERSION,
        'latency_ms': latency_ms,
    }
    _finish(
        analysis,
        status=MatchAnalysis.Status.SUCCEEDED,
        result=result,
        latency_ms=latency_ms,
        documents=documents,
    )
    return analysis


def fail_analysis(analysis_id, code):
    MatchAnalysis.objects.filter(
        pk=analysis_id,
        status__in=[MatchAnalysis.Status.QUEUED, MatchAnalysis.Status.PROCESSING],
    ).update(status=MatchAnalysis.Status.FAILED, error_code=code, completed_at=timezone.now())


@transaction.atomic
def recover_stale_analyses(*, now=None, batch_size=100):
    """Id các phân tích cần gửi lại task."""
    now = now or timezone.now()
    interactive = MatchAnalysis.objects.filter(purpose=MatchAnalysis.Purpose.CANDIDATE_SELF)
    interactive.filter(
        status=MatchAnalysis.Status.QUEUED, created_at__lte=now - QUEUED_TIMEOUT
    ).update(status=MatchAnalysis.Status.FAILED, error_code='analysis_timeout', completed_at=now)
    MatchAnalysis.objects.filter(
        status=MatchAnalysis.Status.PROCESSING, started_at__lte=now - STALE_PROCESSING_AFTER
    ).update(status=MatchAnalysis.Status.QUEUED, started_at=None)
    return list(
        interactive.filter(
            status=MatchAnalysis.Status.QUEUED, created_at__lte=now - REDISPATCH_AFTER
        )
        .order_by('created_at')
        .values_list('pk', flat=True)[:batch_size]
    )

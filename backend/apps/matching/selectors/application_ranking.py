"""Mức phù hợp của hồ sơ ứng tuyển, đọc cho cổng nhà tuyển dụng.

`application_match_annotations()` gắn vào queryset hồ sơ của app `applications` (một
truy vấn con cho mỗi cột, số truy vấn không tăng theo số hồ sơ). Điểm lấy từ lần
chấm **thành công gần nhất** của bản CV đã nộp với tin đó, cùng phiên bản mô hình
và công thức đang chạy: khi tin vừa sửa và đang chấm lại, danh sách vẫn hiện điểm
cũ thay vì trống. Trạng thái (`ready`/`pending`/`failed`/`not_consented`) do
`match_status` suy ra.

Quyền xem thuộc về app `applications` (chỉ người đăng tin thấy hồ sơ); module này
không tự kiểm tra quyền.
"""

from django.db.models import BooleanField, CharField, IntegerField, OuterRef, Subquery, Value
from django.db.models.fields.json import KT

from apps.sitecontent.selectors import get_bool_setting

from ..domain import APPLICATION_RANKING_FLAG, model_version, scoring_cache_version
from ..models import MatchAnalysis

RANKING = MatchAnalysis.Purpose.APPLICATION_RANKING
# Phần của kết quả chỉ dành cho ứng viên: gợi ý sửa CV và câu tóm tắt viết cho ứng viên.
CANDIDATE_ONLY_KEYS = ('suggestions', 'disclaimer')


def application_ranking_enabled():
    return get_bool_setting(APPLICATION_RANKING_FLAG, default=False)


def _rankings(cv_version, job):
    return MatchAnalysis.objects.filter(
        cv_version_id=cv_version,
        job_id=job,
        purpose=RANKING,
        model_version=model_version(),
        scoring_version=scoring_cache_version(),
    ).order_by('-created_at')


def application_match_annotations():
    """Các cột `ai_match_*` cho queryset `Application`; tính năng tắt thì toàn giá trị rỗng."""
    if not application_ranking_enabled():
        return {
            'ai_match_enabled': Value(False, output_field=BooleanField()),
            'ai_match_score': Value(None, output_field=IntegerField()),
            'ai_match_level': Value(None, output_field=CharField()),
            'ai_match_state': Value(None, output_field=CharField()),
        }
    rankings = _rankings(OuterRef('submitted_cv_version_id'), OuterRef('job_id'))
    succeeded = rankings.filter(status=MatchAnalysis.Status.SUCCEEDED)
    return {
        'ai_match_enabled': Value(True, output_field=BooleanField()),
        'ai_match_score': Subquery(succeeded.values('overall_score')[:1]),
        'ai_match_level': Subquery(
            succeeded.annotate(level=KT('result_json__overall__level')).values('level')[:1]
        ),
        # Trạng thái của lần chấm gần nhất (kể cả đang chờ, thất bại).
        'ai_match_state': Subquery(rankings.values('status')[:1]),
    }


def match_status(*, enabled, consented, score, state):
    """Trạng thái hiển thị của một hồ sơ; None khi tính năng tắt."""
    if not enabled:
        return None
    if not consented:
        return 'not_consented'
    if score is not None:
        return 'ready'
    return 'failed' if state == MatchAnalysis.Status.FAILED else 'pending'


def _recruiter_result(result):
    """Kết quả chấm cho nhà tuyển dụng: bỏ gợi ý sửa CV và lời viết cho ứng viên.

    Giao diện tự dựng câu giải thích (dịch được) từ `components[].detail`.
    """
    trimmed = {key: value for key, value in result.items() if key not in CANDIDATE_ONLY_KEYS}
    trimmed['components'] = [
        {key: value for key, value in component.items() if key != 'summary'}
        for component in result.get('components', [])
    ]
    return trimmed


def application_match_detail(application):
    """Chi tiết mức phù hợp của một hồ sơ: `{status, analysed_at, error_code, result}`.

    `application` đã qua kiểm tra quyền của app `applications`.
    """
    enabled = application_ranking_enabled()
    latest = succeeded = None
    if enabled and application.allow_ai_analysis:
        rankings = _rankings(application.submitted_cv_version_id, application.job_id)
        latest = rankings.first()
        succeeded = rankings.filter(status=MatchAnalysis.Status.SUCCEEDED).first()
    status = match_status(
        enabled=enabled,
        consented=application.allow_ai_analysis,
        score=None if succeeded is None else succeeded.overall_score,
        state=None if latest is None else latest.status,
    )
    return {
        'status': status,
        'analysed_at': None if succeeded is None else succeeded.completed_at,
        'error_code': latest.error_code if status == 'failed' else '',
        'result': None if succeeded is None else _recruiter_result(succeeded.result_json),
    }

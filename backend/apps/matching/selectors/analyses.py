"""Kết quả phân tích, luôn lọc theo chủ sở hữu."""

from ..models import MatchAnalysis

RECENT_LIMIT = 10


def _owner_queryset(user):
    return MatchAnalysis.objects.filter(user=user).select_related('job', 'cv_version__cv')


def owner_analysis(user, public_id):
    return _owner_queryset(user).filter(public_id=public_id).first()


def recent_owner_analyses(user, job):
    """Các lần phân tích gần nhất của người dùng cho một tin, mới nhất trước."""
    return list(_owner_queryset(user).filter(job=job).order_by('-created_at')[:RECENT_LIMIT])


def analysis_for_run(analysis_id):
    return MatchAnalysis.objects.select_related('cv_version__cv').filter(pk=analysis_id).first()

"""Kết quả ứng viên tự xem, luôn lọc theo chủ sở hữu.

Bản chấm cho nhà tuyển dụng (`purpose = application_ranking`) cũng mang `user` là
ứng viên nhưng không thuộc các truy vấn này: ứng viên không xem được nó.
"""

from ..models import MatchAnalysis

RECENT_LIMIT = 10


def _owner_queryset(user):
    return MatchAnalysis.objects.filter(
        user=user, purpose=MatchAnalysis.Purpose.CANDIDATE_SELF
    ).select_related('job', 'cv_version__cv')


def owner_analysis(user, public_id):
    return _owner_queryset(user).filter(public_id=public_id).first()


def recent_owner_analyses(user, job):
    """Các lần phân tích gần nhất của người dùng cho một tin, mới nhất trước."""
    return list(_owner_queryset(user).filter(job=job).order_by('-created_at')[:RECENT_LIMIT])

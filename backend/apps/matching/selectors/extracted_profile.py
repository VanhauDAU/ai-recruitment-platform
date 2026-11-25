"""Hồ sơ trích xuất từ CV của chính ứng viên ("Hồ sơ NTD nhìn thấy").

Trường nào được hiển thị do `domain.profile_view` quyết định (danh sách trắng). Hồ sơ
chỉ đọc: sai thì sửa CV, vì điểm phù hợp được giải thích bằng chính nội dung CV.
"""

from ..domain import EXTRACTOR_VERSION, OWNER, RECRUITER_SEARCH, model_version, public_cv_profile
from ..models import MatchDocument

__all__ = [
    'OWNER',
    'RECRUITER_SEARCH',
    'cv_profile_document',
    'owner_cv_profile',
    'public_cv_profile',
]


def cv_profile_document(cv):
    """Tài liệu hiện hành của phiên bản mới nhất của CV, kể cả bản trích xuất lỗi; None nếu chưa có."""
    return (
        MatchDocument.objects.filter(
            kind=MatchDocument.Kind.CV,
            cv_version_id=cv.latest_version_id,
            is_current=True,
            extractor_version=EXTRACTOR_VERSION,
            model_version=model_version(),
        )
        .order_by('-pk')
        .first()
    )


def _profile_state(document):
    if document is None:
        return {'status': 'pending', 'error_code': '', 'profile': None}
    if document.status != MatchDocument.Status.READY:
        return {'status': 'failed', 'error_code': document.error_code, 'profile': None}
    return {
        'status': 'ready',
        'error_code': '',
        'profile': public_cv_profile(document.profile_json, audience=OWNER),
    }


def application_cv_profile(application):
    """Hồ sơ trích xuất từ bản CV đã nộp của một hồ sơ ứng tuyển, cho nhà tuyển dụng.

    Chỉ có khi ứng viên đồng ý phân tích AI (`not_consented` nếu không): trích xuất là một
    phần của việc phân tích. Nhà tuyển dụng đã có CV và liên hệ của người ứng tuyển, nên
    xem cùng phạm vi với chủ CV. `application` đã qua kiểm tra quyền của app `applications`.
    """
    if not application.allow_ai_analysis:
        return {'status': 'not_consented', 'error_code': '', 'profile': None}
    document = (
        MatchDocument.objects.filter(
            kind=MatchDocument.Kind.CV,
            cv_version_id=application.submitted_cv_version_id,
            extractor_version=EXTRACTOR_VERSION,
            model_version=model_version(),
        )
        .order_by('-pk')
        .first()
    )
    return _profile_state(document)


def owner_cv_profile(cv):
    """Hồ sơ trích xuất của CV cho chính chủ: `{status, error_code, profile}`.

    `pending`: CV vừa lưu, chưa trích xuất xong. `failed`: không đọc được CV (ví dụ PDF
    scan), kèm mã lỗi. `ready`: có `profile`.
    """
    return _profile_state(cv_profile_document(cv))

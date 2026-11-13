"""Quản trị CV ứng viên ở mức metadata (CVT-4, kế hoạch CVT-v3 mục 9.5).

Admin không sửa nội dung CV. Xem nội dung cần lý do và mỗi lần xem ghi một
`CvAccessLog` (người xem, lý do, thời điểm). Khóa CV vi phạm thu hồi mọi link
chia sẻ đang mở và chặn tạo link mới; ứng viên vẫn sửa, xuất PDF và ứng tuyển.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import CvAccessLog, CvSharedLink, UserCv
from .audit import record_cv_access

MIN_REASON_LENGTH = 10


def _clean_reason(reason):
    reason = ' '.join(str(reason or '').split())
    if not MIN_REASON_LENGTH <= len(reason) <= 255:
        raise ValidationError({'reason': f'Nhập lý do từ {MIN_REASON_LENGTH} đến 255 ký tự.'})
    return reason


def admin_cv_content(*, cv, actor, reason, request):
    """Phiên bản mới nhất của CV để admin xem, sau khi ghi nhật ký truy cập."""
    reason = _clean_reason(reason)
    version = cv.latest_version
    if version is None:
        raise ValidationError({'cv': 'CV chưa có phiên bản đã lưu.'})
    record_cv_access(
        cv=cv,
        version=version,
        actor_type=CvAccessLog.ActorType.ADMIN,
        access_channel=CvAccessLog.AccessChannel.ADMIN,
        request=request,
        actor_user=actor,
        reason=reason,
    )
    return version


@transaction.atomic
def lock_cv(*, cv, actor, reason):
    cv = UserCv.objects.select_for_update(of=('self',)).get(pk=cv.pk)
    now = timezone.now()
    cv.moderation_locked_at = now
    cv.moderation_lock_reason = _clean_reason(reason)
    cv.moderation_locked_by = actor
    cv.save(
        update_fields=['moderation_locked_at', 'moderation_lock_reason', 'moderation_locked_by']
    )
    CvSharedLink.objects.filter(cv=cv, revoked_at__isnull=True).update(revoked_at=now)
    return cv


@transaction.atomic
def unlock_cv(*, cv):
    cv = UserCv.objects.select_for_update(of=('self',)).get(pk=cv.pk)
    cv.moderation_locked_at = None
    cv.moderation_lock_reason = ''
    cv.moderation_locked_by = None
    cv.save(
        update_fields=['moderation_locked_at', 'moderation_lock_reason', 'moderation_locked_by']
    )
    return cv

"""Ghi nhận và kết luận báo cáo tin tuyển dụng."""

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import JobReport, JobReportResolutionEvent
from .moderation import apply_confirmed_report_hold

TRUST_REPORT_REASONS = {
    JobReport.Reason.FAKE_COMPANY,
    JobReport.Reason.SCAM,
    JobReport.Reason.WRONG_INFO,
}


def submit_job_report(*, job, reporter, reason, detail=''):
    """Tạo báo cáo mới cho một tin đăng.

    Ràng buộc duy nhất theo (job, reporter) chặn báo cáo trùng ở tầng DB; bắt
    IntegrityError thay vì kiểm tra trước để không có khe hở khi gửi song song.
    """
    try:
        with transaction.atomic():
            return JobReport.objects.create(
                job=job,
                reporter=reporter,
                reason=reason,
                detail=(detail or '').strip(),
            )
    except IntegrityError as error:
        raise ValidationError('Bạn đã báo cáo tin tuyển dụng này rồi.') from error


@transaction.atomic
def resolve_job_report(*, report, status, actor, note=''):
    """Kết luận một báo cáo; chỉ `upheld` mới làm mất huy hiệu của NTD."""
    if status not in {JobReport.Status.UPHELD, JobReport.Status.DISMISSED}:
        raise ValidationError('Trạng thái kết luận không hợp lệ.')
    locked = JobReport.objects.select_for_update().select_related('job').get(pk=report.pk)
    if locked.status != JobReport.Status.PENDING:
        raise ValidationError('Báo cáo này đã được xử lý.')

    normalized_note = (note or '').strip()
    if status == JobReport.Status.UPHELD and not normalized_note:
        raise ValidationError({'note': 'Nhập căn cứ xác nhận vi phạm.'})
    JobReportResolutionEvent.objects.create(
        report=locked,
        from_status=locked.status,
        to_status=status,
        note=normalized_note,
        actor=actor,
    )
    locked.status = status
    locked.resolution_note = normalized_note
    locked.resolved_at = timezone.now()
    locked.resolved_by = actor
    locked.save(
        update_fields=['status', 'resolution_note', 'resolved_at', 'resolved_by', 'updated_at']
    )
    if status == JobReport.Status.UPHELD and locked.reason in TRUST_REPORT_REASONS:
        apply_confirmed_report_hold(
            job=locked.job,
            actor=actor,
            report=locked,
            note=normalized_note,
        )
    return locked


@transaction.atomic
def reverse_job_report(*, report, actor, note):
    """Đảo kết luận ``upheld`` sang ``dismissed`` mà không xoá dấu vết."""
    normalized_note = (note or '').strip()
    if not normalized_note:
        raise ValidationError({'note': 'Nhập lý do gỡ kết luận vi phạm.'})

    locked = JobReport.objects.select_for_update().get(pk=report.pk)
    if locked.status != JobReport.Status.UPHELD:
        raise ValidationError('Chỉ báo cáo đã xác nhận vi phạm mới có thể được gỡ.')

    JobReportResolutionEvent.objects.create(
        report=locked,
        from_status=locked.status,
        to_status=JobReport.Status.DISMISSED,
        note=normalized_note,
        actor=actor,
    )
    locked.status = JobReport.Status.DISMISSED
    locked.resolution_note = normalized_note
    locked.resolved_at = timezone.now()
    locked.resolved_by = actor
    locked.save(
        update_fields=['status', 'resolution_note', 'resolved_at', 'resolved_by', 'updated_at']
    )
    return locked

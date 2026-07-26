"""Ghi nhận và kết luận báo cáo tin tuyển dụng."""

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import JobReport


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


def resolve_job_report(*, report, status, actor, note=''):
    """Kết luận một báo cáo; chỉ `upheld` mới làm mất huy hiệu của NTD."""
    if status not in {JobReport.Status.UPHELD, JobReport.Status.DISMISSED}:
        raise ValidationError('Trạng thái kết luận không hợp lệ.')
    if report.status != JobReport.Status.PENDING:
        raise ValidationError('Báo cáo này đã được xử lý.')

    report.status = status
    report.resolution_note = (note or '').strip()
    report.resolved_at = timezone.now()
    report.resolved_by = actor
    report.save(
        update_fields=['status', 'resolution_note', 'resolved_at', 'resolved_by', 'updated_at']
    )
    return report

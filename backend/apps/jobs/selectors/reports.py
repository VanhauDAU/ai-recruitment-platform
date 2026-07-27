"""Read model cho hàng chờ báo cáo tin tuyển dụng của quản trị viên."""

from ..models import JobReport


def job_report_queryset(*, status=None):
    queryset = (
        JobReport.objects.select_related('job', 'job__company', 'reporter', 'resolved_by')
        .prefetch_related('resolution_history__actor')
        .order_by('-created_at')
    )
    if status:
        queryset = queryset.filter(status=status)
    return queryset

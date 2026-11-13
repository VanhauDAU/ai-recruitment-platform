"""Read model cho hàng chờ báo cáo tin tuyển dụng của quản trị viên."""

from django.db.models import Q

from ..models import JobReport

ADMIN_JOB_REPORT_ORDERING_FIELDS = {
    'job_title': 'job__title',
    'company_name': 'job__company__company_name',
    'reason': 'reason',
    'detail': 'detail',
    'reporter_email': 'reporter__email',
    'status': 'status',
    'created_at': 'created_at',
}


def job_report_queryset(*, params=None):
    """Return the filtered, deterministically ordered admin report queue."""

    params = params or {}
    queryset = JobReport.objects.select_related(
        'job',
        'job__company',
        'reporter',
        'resolved_by',
    ).prefetch_related('resolution_history__actor')

    if status := params.get('status'):
        queryset = queryset.filter(status=status)
    if reason := params.get('reason'):
        queryset = queryset.filter(reason=reason)
    if query := (params.get('q') or '').strip():
        queryset = queryset.filter(
            Q(public_id__icontains=query)
            | Q(job__public_id__icontains=query)
            | Q(job__title__icontains=query)
            | Q(job__company__company_name__icontains=query)
            | Q(reporter__email__icontains=query)
            | Q(detail__icontains=query)
            | Q(resolution_note__icontains=query)
        )
    if created_from := params.get('created_from'):
        queryset = queryset.filter(created_at__date__gte=created_from)
    if created_to := params.get('created_to'):
        queryset = queryset.filter(created_at__date__lte=created_to)

    ordering = params.get('ordering') or '-created_at'
    descending = ordering.startswith('-')
    ordering_key = ordering.removeprefix('-')
    ordering_field = ADMIN_JOB_REPORT_ORDERING_FIELDS.get(ordering_key, 'created_at')
    prefix = '-' if descending else ''
    tie_breaker = '-id' if descending else 'id'
    return queryset.order_by(f'{prefix}{ordering_field}', tie_breaker)

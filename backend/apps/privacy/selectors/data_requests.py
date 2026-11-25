from ..models import DataSubjectRequest


def own_data_requests(user, *, limit=20):
    return DataSubjectRequest.objects.filter(user=user)[:limit]


def admin_data_requests_queryset(*, status=None, kind=None):
    queryset = DataSubjectRequest.objects.select_related('user', 'handled_by')
    if status:
        queryset = queryset.filter(status=status)
    if kind:
        queryset = queryset.filter(kind=kind)
    # Hàng chờ: yêu cầu cũ nhất lên trước để kịp hạn xử lý.
    if status == DataSubjectRequest.Status.PENDING:
        return queryset.order_by('created_at', 'id')
    return queryset


def pending_data_requests():
    return DataSubjectRequest.objects.filter(status=DataSubjectRequest.Status.PENDING)

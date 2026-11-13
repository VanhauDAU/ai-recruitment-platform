"""CV ứng viên cho cổng admin (CVT-4): chỉ metadata, một truy vấn cho cả trang."""

from django.db.models import Count, Q

from ..models import CvImportJob, UserCv

FILTERS = {
    'template': 'template__public_id',
    'source': 'source',
    'language': 'language',
    'status': 'lifecycle_status',
}


def admin_cvs_queryset(params):
    queryset = (
        UserCv.objects.filter(is_deleted=False)
        .select_related('user', 'template', 'import_job')
        .annotate(application_count=Count('applications', distinct=True))
        .order_by('-updated_at', '-pk')
    )
    queryset = queryset.filter(
        **{lookup: params[name] for name, lookup in FILTERS.items() if params.get(name)}
    )
    if params.get('import_failed') == 'true':
        queryset = queryset.filter(import_job__status=CvImportJob.Status.FAILED)
    if params.get('locked') == 'true':
        queryset = queryset.filter(moderation_locked_at__isnull=False)
    if search := params.get('q', '').strip():
        queryset = queryset.filter(Q(public_id__iexact=search) | Q(user__public_id__iexact=search))
    return queryset

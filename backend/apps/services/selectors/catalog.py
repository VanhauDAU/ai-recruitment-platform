"""Read-side queries for the public price list and admin lead management."""

from django.db.models import Count, Prefetch, Q

from ..models import ConsultationLead, ServiceCategory, ServicePackage

ADMIN_LEAD_ORDERING_FIELDS = {
    'created_at': 'created_at',
    'full_name': 'full_name',
    'email': 'email',
    'company_name': 'company_name',
    'province': 'province',
    'need': 'need',
    'status': 'status',
}


def active_public_categories_queryset():
    """Nhóm dịch vụ active kèm gói active đã sắp thứ tự (to_attr=active_packages)."""
    return ServiceCategory.objects.filter(is_active=True).prefetch_related(
        Prefetch(
            'packages',
            queryset=ServicePackage.objects.filter(is_active=True).order_by('order', 'slug'),
            to_attr='active_packages',
        )
    )


def admin_service_categories_queryset():
    """Admin categories with a flat package count query for list/detail responses."""
    return ServiceCategory.objects.annotate(packages_count=Count('packages'))


def admin_leads_queryset(params=None):
    """Filtered admin lead read model shared by list and CSV export."""

    params = params or {}
    queryset = ConsultationLead.objects.all()
    if status_filter := params.get('status'):
        queryset = queryset.filter(status=status_filter)
    if query := (params.get('q') or '').strip():
        queryset = queryset.filter(
            Q(full_name__icontains=query)
            | Q(company_name__icontains=query)
            | Q(email__icontains=query)
            | Q(phone__icontains=query)
            | Q(province__icontains=query)
            | Q(note__icontains=query)
            | Q(source_page__icontains=query)
        )
    if created_from := params.get('created_from'):
        queryset = queryset.filter(created_at__date__gte=created_from)
    if created_to := params.get('created_to'):
        queryset = queryset.filter(created_at__date__lte=created_to)

    ordering = params.get('ordering') or '-created_at'
    descending = ordering.startswith('-')
    ordering_key = ordering.removeprefix('-')
    ordering_field = ADMIN_LEAD_ORDERING_FIELDS.get(ordering_key, 'created_at')
    prefix = '-' if descending else ''
    tie_breaker = '-id' if descending else 'id'
    return queryset.order_by(f'{prefix}{ordering_field}', tie_breaker)

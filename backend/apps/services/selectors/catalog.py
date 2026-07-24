"""Read-side queries for the public price list and admin lead management."""

from django.db.models import Count, Prefetch

from ..models import ConsultationLead, ServiceCategory, ServicePackage


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


def admin_leads_queryset(status_filter=None):
    qs = ConsultationLead.objects.all()
    if status_filter:
        qs = qs.filter(status=status_filter)
    return qs

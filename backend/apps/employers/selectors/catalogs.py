"""Read-only company catalogue lists."""

from common.db.aggregates import related_count

from ..models import CompanyIndustry, Industry


def industries_in_use():
    """Industries at least one company works in (the public directory filter)."""
    return Industry.objects.filter(companies__isnull=False).distinct()


def industry_labels():
    return dict(Industry.objects.values_list('id', 'name'))


def active_industries():
    """Lĩnh vực đang mở cho ô chọn khi tạo hoặc sửa hồ sơ công ty."""
    return Industry.objects.filter(is_active=True)


def admin_industries_queryset():
    return Industry.objects.annotate(
        company_count=related_count(CompanyIndustry, 'industry')
    ).order_by('name')

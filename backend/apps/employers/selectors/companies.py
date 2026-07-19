"""Read-only company queries."""

from django.db.models import Q

from common.db.search import search_q

from ..models import Company


def search_companies(text):
    text = (text or '').strip()
    # Bản ghi placeholder của luồng đăng ký cũ không phải công ty catalogue.
    queryset = Company.objects.exclude(
        Q(tax_code__isnull=True)
        & Q(has_no_logo=True)
        & Q(has_no_website=True)
        & Q(company_industries__isnull=True)
    )
    if text:
        queryset = queryset.filter(
            search_q('company_name', text)
            | search_q('trade_name', text)
            | search_q('tax_code', text)
        )
        ordering = ('company_name', 'id')
    else:
        ordering = ('-created_at', '-id')
    return queryset.prefetch_related('industries').distinct().order_by(*ordering)

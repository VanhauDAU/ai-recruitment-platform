"""Read-only company queries."""

from common.db.search import search_q

from ..models import Company


def search_companies(text, *, limit=20):
    text = (text or '').strip()
    if not text:
        return Company.objects.none()
    return (
        Company.objects.filter(
            search_q('company_name', text)
            | search_q('trade_name', text)
            | search_q('tax_code', text)
        )
        .prefetch_related('industries')
        .order_by('company_name')[:limit]
    )

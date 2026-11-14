"""Read model of the administrator queue of company page reports."""

from django.db.models import Q, Value
from django.db.models.functions import Coalesce, NullIf, Trim

from common.db.search import search_q

from ..models import CompanyReport

# Public sort key -> ORM path. Anything else never reaches ``order_by``.
ADMIN_COMPANY_REPORT_ORDERING_FIELDS = {
    'company_name': 'company_display_name',
    'reason': 'reason',
    'detail': 'detail',
    'reporter_email': 'reporter__email',
    'status': 'status',
    'created_at': 'created_at',
}


def admin_company_reports_queryset(*, params=None):
    """Filtered, deterministically ordered reports with everything a row reads."""
    params = params or {}
    queryset = (
        CompanyReport.objects.select_related('company', 'reporter', 'resolved_by')
        .prefetch_related('resolution_history__actor')
        # Same rule as Company.display_name, so the sort follows what a row shows.
        .alias(
            company_display_name=Coalesce(
                NullIf(Trim('company__trade_name'), Value('')),
                'company__company_name',
            )
        )
    )

    if status := params.get('status'):
        queryset = queryset.filter(status=status)
    if reason := params.get('reason'):
        queryset = queryset.filter(reason=reason)
    if company_public_id := params.get('company'):
        queryset = queryset.filter(company__public_id=company_public_id)
    if query := params.get('q'):
        queryset = queryset.filter(
            Q(public_id__icontains=query)
            | Q(company__public_id__icontains=query)
            | search_q('company__company_name', query)
            | search_q('company__trade_name', query)
            | Q(reporter__email__icontains=query)
            | Q(detail__icontains=query)
            | Q(resolution_note__icontains=query)
        )

    ordering = params.get('ordering') or '-created_at'
    descending = ordering.startswith('-')
    ordering_field = ADMIN_COMPANY_REPORT_ORDERING_FIELDS.get(
        ordering.removeprefix('-'), 'created_at'
    )
    prefix = '-' if descending else ''
    return queryset.order_by(f'{prefix}{ordering_field}', f'{prefix}id')

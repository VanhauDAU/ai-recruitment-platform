"""Reads of the page-content post-moderation log (``CompanyContentChange``)."""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from apps.jobs.models import Benefit
from apps.locations.models import Location

from ..models import CompanyContentChange

# Uploads must follow the publish that announced them.
CONTENT_CHANGE_UPLOAD_WINDOW = timedelta(minutes=30)


def uploadable_content_change(*, company, actor, public_id, kind):
    """The caller's recent unreviewed change that announced ``kind``, or ``None``."""
    return CompanyContentChange.objects.filter(
        public_id=public_id,
        company=company,
        actor=actor,
        status=CompanyContentChange.Status.UNREVIEWED,
        created_at__gte=timezone.now() - CONTENT_CHANGE_UPLOAD_WINDOW,
        pending_media__contains=[kind],
    ).first()


def admin_company_content_changes_queryset(*, params=None):
    """Published changes for administrators, newest first.

    ``status`` defaults to unreviewed (``all`` lifts it); ``company`` takes a
    public id and ``q`` searches the company name or the editor's email. A
    publish whose announced files never arrived has nothing to review.
    """
    params = params or {}
    queryset = (
        CompanyContentChange.objects.select_related('company', 'actor', 'reviewed_by')
        .exclude(changes={})
        .order_by('-created_at', '-id')
    )
    status = params.get('status') or CompanyContentChange.Status.UNREVIEWED
    if status != 'all':
        queryset = queryset.filter(status=status)
    if params.get('company'):
        queryset = queryset.filter(company__public_id=params['company'])
    query = (params.get('q') or '').strip()
    if query:
        queryset = queryset.filter(
            Q(company__company_name__icontains=query) | Q(actor__email__icontains=query)
        )
    return queryset


def unreviewed_content_change_count():
    return (
        CompanyContentChange.objects.filter(status=CompanyContentChange.Status.UNREVIEWED)
        .exclude(changes={})
        .count()
    )


def content_change_labels(changes):
    """Benefit and province names the given changes mention, in two queries."""
    benefit_ids, province_ids = set(), set()
    for change in changes:
        for values in (change.changes or {}, change.previous or {}):
            benefit_ids.update(item['benefit_id'] for item in values.get('benefits', []))
            province_ids.update(item['province_id'] for item in values.get('offices', []))
    return {
        'benefits': dict(Benefit.objects.filter(id__in=benefit_ids).values_list('id', 'name')),
        'provinces': dict(Location.objects.filter(id__in=province_ids).values_list('id', 'name')),
    }

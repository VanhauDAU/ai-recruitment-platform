"""Query primitives for configured job-alert matching and normalization."""

from django.db.models import Exists, OuterRef, Q

from common.db.search import search_q

from .alerts import CandidateJobDigestItem, CandidateJobEmailSuppression, JobAlert
from .core import JobCategory
from .querysets import active_jobs_queryset, filter_alert_salary_bucket_queryset


def _category_graph():
    children_by_parent = {}
    for category_id, parent_id in JobCategory.objects.values_list('id', 'parent_id'):
        children_by_parent.setdefault(parent_id, []).append(category_id)
    return children_by_parent


def expanded_category_ids(category_ids):
    """Return selected taxonomy nodes and every descendant using one flat query."""
    selected = {int(category_id) for category_id in category_ids}
    if not selected:
        return []
    children_by_parent = _category_graph()
    expanded = set(selected)
    pending = list(selected)
    while pending:
        parent_id = pending.pop()
        for child_id in children_by_parent.get(parent_id, ()):
            if child_id not in expanded:
                expanded.add(child_id)
                pending.append(child_id)
    return sorted(expanded)


def category_leaf_coverage_ids(category_ids):
    """Normalize equivalent parent/child selections to the same leaf coverage."""
    selected = {int(category_id) for category_id in category_ids}
    if not selected:
        return []
    children_by_parent = _category_graph()
    leaves = set()
    visited = set()
    pending = list(selected)
    while pending:
        category_id = pending.pop()
        if category_id in visited:
            continue
        visited.add(category_id)
        children = children_by_parent.get(category_id, ())
        if children:
            pending.extend(children)
        else:
            leaves.add(category_id)
    return sorted(leaves or selected)


def strict_job_alert_matches(
    alert,
    *,
    published_before,
    limit=50,
    job_ids=None,
    exclude_digest_id=None,
    ignore_cursor=False,
):
    """Match one saved alert using only explicit criteria, never profile/CV consent."""
    emailed_job = CandidateJobEmailSuppression.objects.filter(
        candidate=alert.candidate,
        job_id=OuterRef('pk'),
    )
    in_flight = CandidateJobDigestItem.objects.filter(
        candidate=alert.candidate,
        job_id=OuterRef('pk'),
        digest__status__in=('pending', 'sending'),
    )
    if exclude_digest_id is not None:
        in_flight = in_flight.exclude(digest_id=exclude_digest_id)
    queryset = (
        active_jobs_queryset()
        .filter(published_at__lte=published_before)
        .exclude(applications__candidate=alert.candidate)
        .exclude(saved_by__candidate=alert.candidate)
        .annotate(already_emailed=Exists(emailed_job))
        .annotate(already_claimed=Exists(in_flight))
        .filter(already_emailed=False, already_claimed=False)
    )
    if not ignore_cursor:
        queryset = queryset.filter(published_at__gt=alert.cursor_at)
    if job_ids is not None:
        queryset = queryset.filter(pk__in=job_ids)

    title_query = search_q('title', alert.keyword)
    company_query = search_q('company__company_name', alert.keyword)
    if alert.keyword_scope == JobAlert.KeywordScope.COMPANY:
        queryset = queryset.filter(company_query)
    elif alert.keyword_scope == JobAlert.KeywordScope.BOTH:
        queryset = queryset.filter(title_query | company_query)
    else:
        queryset = queryset.filter(title_query)

    selected_category_ids = [category.pk for category in alert.categories.all()]
    if selected_category_ids:
        queryset = queryset.filter(
            category_assignments__category_id__in=expanded_category_ids(selected_category_ids)
        )
    if alert.ward_id:
        queryset = queryset.filter(job_locations__location_id=alert.ward_id)
    elif alert.province_id:
        queryset = queryset.filter(
            Q(job_locations__location_id=alert.province_id)
            | Q(job_locations__location__parent_id=alert.province_id)
        )
    if alert.salary_bucket:
        queryset = filter_alert_salary_bucket_queryset(queryset, alert.salary_bucket)
    if alert.experience_years:
        queryset = queryset.filter(experience_years=alert.experience_years)
    if alert.work_type:
        queryset = queryset.filter(work_type=alert.work_type)
    if alert.employment_type:
        queryset = queryset.filter(employment_type=alert.employment_type)

    queryset = queryset.distinct().order_by('-published_at', '-created_at', '-pk')
    return queryset[:limit] if limit is not None else queryset

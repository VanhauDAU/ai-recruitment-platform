"""Read side of candidates following a company."""

from django.db.models import F, OuterRef, Subquery

from ..models import Company, CompanyFollow
from .companies import public_company_projection


def company_follow_state(*, company, candidate):
    """One candidate's follow of ``company`` next to the public follower total."""
    own_follow = CompanyFollow.objects.filter(company_id=OuterRef('pk'), candidate=candidate)
    follower_count, notify_new_jobs = (
        Company.objects.filter(pk=company.pk)
        .annotate(own_notify_new_jobs=Subquery(own_follow.values('notify_new_jobs')[:1]))
        .values_list('follower_count', 'own_notify_new_jobs')
        .get()
    )
    # The subquery is NULL exactly when the candidate has no follow row.
    return {
        'following': notify_new_jobs is not None,
        'notify_new_jobs': bool(notify_new_jobs),
        'follower_count': follower_count,
    }


def followed_companies_queryset(candidate):
    """Visible companies ``candidate`` follows, newest follow first.

    The filter and both annotations share one join, which the
    (candidate, company) unique constraint keeps at one row per company.
    """
    followed = Company.objects.filter(follows__candidate=candidate, content_policy_hold=False)
    return (
        public_company_projection(followed)
        .annotate(
            followed_at=F('follows__created_at'),
            notify_new_jobs=F('follows__notify_new_jobs'),
        )
        .order_by('-followed_at', '-follows__id')
    )

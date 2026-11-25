"""Homepage market dashboard: six grouped queries, cached as one payload.

The payload is the same for every visitor, so it is built at most once per
``STATS_CACHE_SECONDS``. The cache keeps media storage keys and salary band
keys, never absolute URLs or translated labels: those depend on the request
(domain/CDN, Accept-Language) and are resolved in ``build_job_stats``.
"""

from datetime import timedelta

from django.contrib.postgres.aggregates import StringAgg
from django.core.cache import cache
from django.db.models import Count, OuterRef, Prefetch, Q, Subquery
from django.db.models.functions import Coalesce, JSONObject
from django.utils import timezone
from django.utils.html import strip_tags
from django.utils.translation import gettext as _

from apps.accounts.models import User
from apps.employers.models import Company
from common.storage.media import media_url_from_value

from ..models import Job, JobCategory, JobCategoryAssignment, JobLocation, listing_recency
from ..models.querysets import SALARY_BUCKET_VALUE, salary_bucket_condition
from .listing import SALARY_BUCKETS, publicly_available_job_filter

STATS_CACHE_KEY = 'jobs:public-stats:v1'
STATS_CACHE_SECONDS = 5 * 60
GROWTH_DAYS = 7
DEMAND_LIMIT = 24
SALARY_DEMAND_LIMIT = 6
LATEST_JOBS_LIMIT = 10
FEATURED_EMPLOYERS_LIMIT = 18
NEGOTIABLE_SALARY_KEY = 'negotiable'


def _day_starts(now):
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return [today - timedelta(days=offset) for offset in range(GROWTH_DAYS - 1, -1, -1)]


def _job_totals(active_jobs, now):
    """Headline counts, the 7-day growth series and salary bands in one aggregate."""
    day_starts = _day_starts(now)
    aggregates = {
        'active_jobs': Count('id'),
        'companies': Count('company_id', distinct=True),
        'new_jobs_24h': Count('id', filter=Q(published__gte=now - timedelta(days=1))),
        'salary_negotiable': Count('id', filter=Q(salary_type=Job.SalaryType.NEGOTIABLE)),
    }
    for index, start in enumerate(day_starts):
        aggregates[f'growth_{index}'] = Count(
            'id', filter=Q(published__gte=start, published__lt=start + timedelta(days=1))
        )
    for index, (key, *_rest) in enumerate(SALARY_BUCKETS):
        aggregates[f'salary_{index}'] = Count('id', filter=salary_bucket_condition(key))
    totals = active_jobs.annotate(salary_bucket_value=SALARY_BUCKET_VALUE).aggregate(**aggregates)

    salary_demand = [
        {'key': key, 'count': totals[f'salary_{index}']}
        for index, (key, *_rest) in enumerate(SALARY_BUCKETS)
        if totals[f'salary_{index}']
    ]
    if totals['salary_negotiable']:
        salary_demand.append({'key': NEGOTIABLE_SALARY_KEY, 'count': totals['salary_negotiable']})
    return {
        'active_jobs': totals['active_jobs'],
        'companies': totals['companies'],
        'new_jobs_24h': totals['new_jobs_24h'],
        'growth': [
            {'date': start.strftime('%d/%m'), 'count': totals[f'growth_{index}']}
            for index, start in enumerate(day_starts)
        ],
        'salary_demand': salary_demand[:SALARY_DEMAND_LIMIT],
    }


def _category_demand(active_jobs):
    """Jobs per active top-level category, counting its children and grandchildren.

    Every assignment is folded to its root in SQL (the taxonomy is three levels
    deep), so one GROUP BY replaces three queries per category.
    """
    root_id = Coalesce('category__parent__parent_id', 'category__parent_id', 'category_id')
    root = JobCategory.objects.filter(
        pk=OuterRef('root_id'),
        parent__isnull=True,
        status=JobCategory.Status.ACTIVE,
    ).values(info=JSONObject(name='name', slug='slug', logo_url='logo_url'))
    rows = (
        JobCategoryAssignment.objects.filter(job__in=active_jobs.values('pk'))
        .annotate(root_id=root_id)
        .order_by()
        .values('root_id')
        .annotate(count=Count('job_id', distinct=True), root=Subquery(root))
    )
    demand = [
        {
            'id': row['root_id'],
            'name': row['root']['name'],
            'slug': row['root']['slug'],
            'logo_url': row['root']['logo_url'],
            'count': row['count'],
        }
        for row in rows
        if row['root'] and row['count']
    ]
    return sorted(demand, key=lambda item: item['count'], reverse=True)[:DEMAND_LIMIT]


def _latest_jobs(active_jobs):
    jobs = (
        active_jobs.select_related('company')
        .prefetch_related(
            Prefetch(
                'job_locations',
                queryset=JobLocation.objects.select_related('location__parent'),
            )
        )
        .order_by('-published')[:LATEST_JOBS_LIMIT]
    )
    result = []
    for job in jobs:
        province_names = list(
            dict.fromkeys(
                item.location.parent.name if item.location.parent else item.location.name
                for item in job.job_locations.all()
            )
        )
        result.append(
            {
                'public_id': job.public_id,
                'slug': job.slug,
                'title': job.title,
                'company_name': job.company.company_name,
                'company_logo_url': job.company.logo_url,
                'location_name': province_names[0] if province_names else '',
                'location_names': province_names,
                'work_type': job.work_type,
                'employment_type': job.employment_type,
                'experience_years': job.experience_years,
                'salary_min': job.salary_min,
                'salary_max': job.salary_max,
                'currency': job.currency,
                'salary_type': job.salary_type,
                'number_of_vacancies': job.number_of_vacancies,
                'deadline': job.deadline,
                'published_at': job.published,
                'short_description': strip_tags(job.description).strip()[:240],
            }
        )
    return result


def _featured_employers(active_jobs):
    industries = (
        Company.objects.filter(pk=OuterRef('company_id'))
        .annotate(names=StringAgg('industries__name', delimiter=', ', distinct=True))
        .values('names')
    )
    employers = (
        # Each entry links to the company page, which answers 404 while held.
        active_jobs.filter(company__content_policy_hold=False)
        .order_by()
        .values(
            'company_id',
            'company__public_id',
            'company__company_name',
            'company__slug',
            'company__logo_url',
        )
        .annotate(job_count=Count('id'), industry=Subquery(industries))
        .order_by('-job_count', 'company__company_name')[:FEATURED_EMPLOYERS_LIMIT]
    )
    return [
        {
            'id': item['company_id'],
            'public_id': item['company__public_id'],
            'company_name': item['company__company_name'],
            'slug': item['company__slug'],
            'company_logo_url': item['company__logo_url'],
            'industry': item['industry'] or '',
            'job_count': item['job_count'],
        }
        for item in employers
    ]


def _platform_account_counts():
    return User.objects.filter(
        is_active=True,
        is_deleted=False,
        status=User.Status.ACTIVE,
    ).aggregate(
        candidates=Count('id', filter=Q(role=User.Role.CANDIDATE)),
        employers=Count('id', filter=Q(role=User.Role.EMPLOYER)),
    )


def job_stats_payload():
    """Request-independent dashboard data; cached for ``STATS_CACHE_SECONDS``."""
    payload = cache.get(STATS_CACHE_KEY)
    if payload is not None:
        return payload
    now = timezone.now()
    active_jobs = Job.objects.filter(publicly_available_job_filter()).annotate(
        # Một mốc với danh sách (ADR-0030): mở lại tin không thành "tin mới".
        published=listing_recency()
    )
    payload = {
        **_platform_account_counts(),
        **_job_totals(active_jobs, now),
        'demand': _category_demand(active_jobs),
        'latest_jobs': _latest_jobs(active_jobs),
        'featured_employers': _featured_employers(active_jobs),
    }
    cache.set(STATS_CACHE_KEY, payload, STATS_CACHE_SECONDS)
    return payload


def _salary_label(key):
    if key == NEGOTIABLE_SALARY_KEY:
        return _('Thỏa thuận')
    return str(next(name for bucket_key, name, *_rest in SALARY_BUCKETS if bucket_key == key))


def build_job_stats(request):
    """Build the homepage market dashboard response for ``request``."""
    payload = job_stats_payload()

    def media(value):
        return media_url_from_value(value, request=request)

    return {
        **payload,
        'demand': [{**item, 'logo_url': media(item['logo_url'])} for item in payload['demand']],
        'salary_demand': [
            {'name': _salary_label(item['key']), 'count': item['count']}
            for item in payload['salary_demand']
        ],
        'latest_jobs': [
            {**item, 'company_logo_url': media(item['company_logo_url'])}
            for item in payload['latest_jobs']
        ],
        'featured_employers': [
            {**item, 'company_logo_url': media(item['company_logo_url'])}
            for item in payload['featured_employers']
        ],
    }

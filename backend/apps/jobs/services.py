from datetime import timedelta

from django.contrib.postgres.aggregates import StringAgg
from django.db.models import Count, Q
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.employers.models import EmployerProfile
from common.media_storage import media_url_from_value

from .models import Job, JobCategory
from .querysets import SALARY_BUCKETS, filter_salary_bucket


def _growth_series(active_jobs, now):
    growth = []
    for offset in range(6, -1, -1):
        day = (now - timedelta(days=offset)).date()
        day_start = now.replace(
            year=day.year, month=day.month, day=day.day,
            hour=0, minute=0, second=0, microsecond=0,
        )
        growth.append({
            'date': day.strftime('%d/%m'),
            'count': active_jobs.filter(
                published__gte=day_start,
                published__lt=day_start + timedelta(days=1),
            ).count(),
        })
    return growth


def _category_demand(active_jobs, request):
    demand = []
    top_categories = JobCategory.objects.filter(
        parent__isnull=True,
        status=JobCategory.Status.ACTIVE,
    )
    for category in top_categories:
        children = list(
            JobCategory.objects.filter(parent=category).values_list('id', flat=True)
        )
        grandchildren = list(
            JobCategory.objects.filter(parent_id__in=children).values_list('id', flat=True)
        )
        count = active_jobs.filter(
            category_id__in=[category.id, *children, *grandchildren]
        ).count()
        if count:
            demand.append({
                'id': category.id,
                'name': category.name,
                'slug': category.slug,
                'logo_url': media_url_from_value(category.logo_url, request=request),
                'count': count,
            })
    return sorted(demand, key=lambda item: item['count'], reverse=True)[:24]


def _salary_demand(active_jobs):
    demand = []
    for key, name, _lower, _upper in SALARY_BUCKETS:
        count = filter_salary_bucket(active_jobs, key).count()
        if count:
            demand.append({'name': name, 'count': count})
    negotiable_count = active_jobs.filter(
        Q(is_salary_visible=False)
        | (Q(salary_min__isnull=True) & Q(salary_max__isnull=True))
    ).count()
    if negotiable_count:
        demand.append({'name': 'Thỏa thuận', 'count': negotiable_count})
    return demand[:6]


def _latest_jobs(active_jobs):
    jobs = (
        active_jobs.select_related('employer_profile')
        .prefetch_related('locations')
        .order_by('-published')[:10]
    )
    result = []
    for job in jobs:
        locations = list(job.locations.all())
        result.append({
            'public_id': job.public_id,
            'slug': job.slug,
            'title': job.title,
            'company_name': job.employer_profile.company_name,
            'location_name': locations[0].name if locations else '',
            'location_names': [location.name for location in locations],
            'work_type': job.work_type,
            'employment_type': job.employment_type,
            'experience_level': job.experience_level,
            'salary_min': job.salary_min,
            'salary_max': job.salary_max,
            'currency': job.currency,
            'is_salary_visible': job.is_salary_visible,
            'number_of_vacancies': job.number_of_vacancies,
            'deadline': job.deadline,
            'published_at': job.published,
            'short_description': job.short_description,
        })
    return result


def _featured_employers(active_jobs, request):
    employers = list(
        active_jobs.values(
            'employer_profile_id',
            'employer_profile__public_id',
            'employer_profile__company_name',
            'employer_profile__slug',
            'employer_profile__company_logo_url',
        )
        .annotate(job_count=Count('id'))
        .order_by('-job_count', 'employer_profile__company_name')[:18]
    )
    industry_names = {
        row['id']: row['names']
        for row in EmployerProfile.objects.filter(
            id__in=[item['employer_profile_id'] for item in employers]
        )
        .values('id')
        .annotate(names=StringAgg('industries__name', delimiter=', ', distinct=True))
    }
    return [
        {
            'id': item['employer_profile_id'],
            'public_id': item['employer_profile__public_id'],
            'company_name': item['employer_profile__company_name'],
            'slug': item['employer_profile__slug'],
            'company_logo_url': media_url_from_value(
                item['employer_profile__company_logo_url'], request=request,
            ),
            'industry': industry_names.get(item['employer_profile_id']) or '',
            'job_count': item['job_count'],
        }
        for item in employers
    ]


def build_job_stats(request):
    """Build the homepage market dashboard payload."""
    now = timezone.now()
    active_jobs = Job.objects.filter(status=Job.Status.ACTIVE).annotate(
        published=Coalesce('published_at', 'created_at')
    )
    return {
        'active_jobs': active_jobs.count(),
        'companies': active_jobs.values('employer_profile').distinct().count(),
        'new_jobs_24h': active_jobs.filter(
            published__gte=now - timedelta(days=1)
        ).count(),
        'growth': _growth_series(active_jobs, now),
        'demand': _category_demand(active_jobs, request),
        'salary_demand': _salary_demand(active_jobs),
        'latest_jobs': _latest_jobs(active_jobs),
        'featured_employers': _featured_employers(active_jobs, request),
    }

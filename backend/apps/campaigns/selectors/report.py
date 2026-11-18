"""Read models for the exported campaign report (daily applications and jobs)."""

from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate

from apps.applications.models import Application
from apps.jobs.models import Job
from common.vietnam_time import VIETNAM_TZ, vietnam_day_start, vietnam_today


def daily_applications(campaign, *, days=30):
    today = vietnam_today()
    start = today - timedelta(days=days - 1)
    counts = dict(
        Application.objects.filter(job__campaign=campaign, applied_at__gte=vietnam_day_start(start))
        .annotate(day=TruncDate('applied_at', tzinfo=VIETNAM_TZ))
        .values_list('day')
        .annotate(total=Count('id'))
    )
    return [
        {
            'date': start + timedelta(days=offset),
            'applications': counts.get(start + timedelta(days=offset), 0),
        }
        for offset in range(days)
    ]


def report_jobs(campaign):
    return list(
        Job.objects.filter(campaign=campaign)
        .annotate(
            current_applications=Count('applications', filter=Q(applications__is_current=True)),
            hires=Count(
                'applications',
                filter=Q(applications__is_current=True, applications__status='accepted'),
            ),
        )
        .order_by('-published_at', '-pk')
        .values(
            'title', 'status', 'number_of_vacancies', 'deadline', 'current_applications', 'hires'
        )
    )

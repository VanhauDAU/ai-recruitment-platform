from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count, F, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.applications.models import Application
from apps.jobs.models import Job, JobEngagementDaily

from ..models import RecruitmentCampaign

REPORT_TIME_ZONE = ZoneInfo('Asia/Ho_Chi_Minh')


def campaign_list_queryset(user, *, status=None, scope=None, q=None):
    today = timezone.localdate()
    queryset = RecruitmentCampaign.objects.filter(owner__user=user)
    if status:
        queryset = queryset.filter(status=status)
    if q:
        queryset = queryset.filter(name__icontains=q.strip())
    queryset = queryset.annotate(
        job_count=Count('jobs', distinct=True),
        draft_job_count=Count('jobs', filter=Q(jobs__status='draft'), distinct=True),
        pending_job_count=Count('jobs', filter=Q(jobs__status='pending'), distinct=True),
        active_job_count=Count(
            'jobs',
            filter=Q(jobs__status='active')
            & (Q(jobs__deadline__isnull=True) | Q(jobs__deadline__gte=today)),
            distinct=True,
        ),
        expired_job_count=Count(
            'jobs',
            filter=Q(jobs__status='active', jobs__deadline__lt=today),
            distinct=True,
        ),
        closed_job_count=Count('jobs', filter=Q(jobs__status='closed'), distinct=True),
        rejected_job_count=Count('jobs', filter=Q(jobs__status='rejected'), distinct=True),
        application_count=Count('jobs__applications', distinct=True),
        unviewed_application_count=Count(
            'jobs__applications',
            filter=Q(jobs__applications__status=Application.Status.SUBMITTED),
            distinct=True,
        ),
        accepted_count=Count(
            'jobs__applications',
            filter=Q(jobs__applications__status=Application.Status.ACCEPTED),
            distinct=True,
        ),
    )
    if scope == 'open':
        queryset = queryset.filter(status=RecruitmentCampaign.Status.ACTIVE)
    elif scope == 'needs_review':
        queryset = queryset.filter(unviewed_application_count__gt=0)
    elif scope == 'active_jobs':
        queryset = queryset.filter(active_job_count__gt=0)
    elif scope == 'pending_jobs':
        queryset = queryset.filter(pending_job_count__gt=0)
    elif scope == 'expired_jobs':
        queryset = queryset.filter(expired_job_count__gt=0)
    return queryset.order_by('-created_at')


def campaign_detail_queryset(user):
    return campaign_list_queryset(user)


def campaign_options(user):
    return campaign_list_queryset(user).exclude(
        status__in=[RecruitmentCampaign.Status.COMPLETED, RecruitmentCampaign.Status.CANCELLED]
    )


def campaign_report(campaign):
    applications = Application.objects.filter(job__campaign=campaign)
    statuses = {state: 0 for state in Application.Status.values}
    statuses.update(
        {
            row['status']: row['count']
            for row in applications.values('status').annotate(count=Count('id'))
        }
    )
    today = timezone.localdate()
    start = today - timedelta(days=6)
    by_day = {
        row['day']: row['count']
        for row in applications.filter(applied_at__date__gte=start)
        .annotate(day=TruncDate('applied_at'))
        .values('day')
        .annotate(count=Count('id'))
    }
    jobs = campaign.jobs.all()
    job_statuses = {state: 0 for state in ('draft', 'pending', 'active', 'closed', 'rejected')}
    job_statuses.update(
        {row['status']: row['count'] for row in jobs.values('status').annotate(count=Count('id'))}
    )
    expired_jobs = jobs.filter(status='active', deadline__lt=today).count()
    total_jobs = sum(job_statuses.values())
    job_statuses['active'] = max(job_statuses['active'] - expired_jobs, 0)
    return {
        'campaign_public_id': campaign.public_id,
        'accepted_count': statuses[Application.Status.ACCEPTED],
        'jobs': {
            'total': total_jobs,
            **job_statuses,
            'expired': expired_jobs,
            'views': sum(jobs.values_list('view_count', flat=True)),
        },
        'applications': {
            'total': sum(statuses.values()),
            'new': statuses[Application.Status.SUBMITTED],
        },
        'funnel': statuses,
        'daily_applications': [
            {
                'date': start + timedelta(days=offset),
                'count': by_day.get(start + timedelta(days=offset), 0),
            }
            for offset in range(7)
        ],
    }


def _rate(numerator, denominator):
    if not denominator:
        return None
    return round((numerator / denominator) * 100, 2)


def campaign_job_performance(campaign, *, days=7):
    """Return period-aligned engagement metrics without using lifetime counters."""
    today = timezone.localdate(timezone=REPORT_TIME_ZONE)
    start = today - timedelta(days=days - 1)
    end_exclusive = today + timedelta(days=1)
    start_at = datetime.combine(start, time.min, tzinfo=REPORT_TIME_ZONE)
    end_at = datetime.combine(end_exclusive, time.min, tzinfo=REPORT_TIME_ZONE)

    jobs = list(
        Job.objects.filter(campaign=campaign)
        .order_by('-created_at')
        .values(
            'id',
            'public_id',
            'slug',
            'title',
            'status',
            'rejected_reason',
            'deadline',
            'engagement_tracking_started_at',
        )
    )
    job_ids = [job['id'] for job in jobs]
    engagement_rows = JobEngagementDaily.objects.filter(
        job_id__in=job_ids,
        date__gte=start,
        date__lte=today,
    ).values('job_id', 'date', 'impression_count', 'view_count')
    application_rows = (
        Application.objects.filter(
            job_id__in=job_ids,
            applied_at__gte=start_at,
            applied_at__lt=end_at,
        )
        .filter(applied_at__gte=F('job__engagement_tracking_started_at'))
        .annotate(day=TruncDate('applied_at', tzinfo=REPORT_TIME_ZONE))
        .values('job_id', 'day')
        .annotate(count=Count('id'))
    )

    engagement_by_job_day = {(row['job_id'], row['date']): row for row in engagement_rows}
    applications_by_job_day = {
        (row['job_id'], row['day']): row['count'] for row in application_rows
    }
    tracking_dates = {
        job['id']: timezone.localtime(
            job['engagement_tracking_started_at'],
            timezone=REPORT_TIME_ZONE,
        ).date()
        for job in jobs
    }
    dates = [start + timedelta(days=offset) for offset in range(days)]

    job_results = []
    for job in jobs:
        tracking_date = tracking_dates[job['id']]
        available = tracking_date <= today
        valid_dates = [date for date in dates if date >= tracking_date]
        impressions = sum(
            engagement_by_job_day.get((job['id'], date), {}).get('impression_count', 0)
            for date in valid_dates
        )
        views = sum(
            engagement_by_job_day.get((job['id'], date), {}).get('view_count', 0)
            for date in valid_dates
        )
        applications = sum(
            applications_by_job_day.get((job['id'], date), 0) for date in valid_dates
        )
        deadline = job['deadline']
        job_results.append(
            {
                'public_id': job['public_id'],
                'slug': job['slug'],
                'title': job['title'],
                'status': job['status'],
                'rejected_reason': job['rejected_reason'],
                'deadline': deadline,
                'is_expired': bool(
                    job['status'] == Job.Status.ACTIVE and deadline is not None and deadline < today
                ),
                'available': available,
                'data_available_from': tracking_date,
                'impressions': impressions,
                'views': views,
                'applications': applications,
                'view_rate': _rate(views, impressions) if available else None,
                'application_rate': _rate(applications, views) if available else None,
            }
        )

    daily = []
    for date in dates:
        eligible_job_ids = [job_id for job_id in job_ids if tracking_dates[job_id] <= date]
        available = bool(eligible_job_ids)
        daily.append(
            {
                'date': date,
                'available': available,
                'impressions': (
                    sum(
                        engagement_by_job_day.get((job_id, date), {}).get('impression_count', 0)
                        for job_id in eligible_job_ids
                    )
                    if available
                    else None
                ),
                'views': (
                    sum(
                        engagement_by_job_day.get((job_id, date), {}).get('view_count', 0)
                        for job_id in eligible_job_ids
                    )
                    if available
                    else None
                ),
                'applications': (
                    sum(
                        applications_by_job_day.get((job_id, date), 0)
                        for job_id in eligible_job_ids
                    )
                    if available
                    else None
                ),
            }
        )

    total_impressions = sum(job['impressions'] for job in job_results)
    total_views = sum(job['views'] for job in job_results)
    total_applications = sum(job['applications'] for job in job_results)
    data_available_from = min(tracking_dates.values()) if tracking_dates else None
    return {
        'campaign_public_id': campaign.public_id,
        'range': {'days': days, 'start': start, 'end': today},
        'data_available_from': data_available_from,
        'summary': {
            'impressions': total_impressions,
            'views': total_views,
            'applications': total_applications,
            'view_rate': _rate(total_views, total_impressions),
            'application_rate': _rate(total_applications, total_views),
        },
        'daily': daily,
        'jobs': job_results,
    }

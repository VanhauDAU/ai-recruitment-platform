from collections import defaultdict
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count, DateTimeField, F, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from apps.applications.models import Application
from apps.jobs.models import Job, JobEngagementDaily

from ..models import CampaignActivity, RecruitmentCampaign

REPORT_TIME_ZONE = ZoneInfo('Asia/Ho_Chi_Minh')


def campaign_list_queryset(user, *, status=None, scope=None, q=None, ordering=None):
    today = timezone.localdate()
    latest_activity = CampaignActivity.objects.filter(campaign_id=OuterRef('pk')).order_by(
        '-occurred_at', '-id'
    )
    latest_application_for_pair = (
        Application.objects.filter(
            candidate_id=OuterRef('candidate_id'),
            job_id=OuterRef('job_id'),
        )
        .order_by('-applied_at', '-id')
        .values('id')[:1]
    )
    latest_unviewed = (
        Application.objects.filter(
            job__campaign_id=OuterRef('pk'),
            status=Application.Status.SUBMITTED,
            id=Subquery(latest_application_for_pair),
        )
        .values('job__campaign_id')
        .annotate(total=Count('id'))
        .values('total')[:1]
    )
    latest_application_pairs = (
        Application.objects.filter(
            job__campaign_id=OuterRef('pk'),
            id=Subquery(latest_application_for_pair),
        )
        .values('job__campaign_id')
        .annotate(total=Count('id'))
        .values('total')[:1]
    )
    latest_accepted = (
        Application.objects.filter(
            job__campaign_id=OuterRef('pk'),
            status=Application.Status.ACCEPTED,
            id=Subquery(latest_application_for_pair),
        )
        .values('job__campaign_id')
        .annotate(total=Count('candidate_id', distinct=True))
        .values('total')[:1]
    )
    queryset = RecruitmentCampaign.objects.filter(owner__user=user)
    if status:
        queryset = queryset.filter(status=status)
    if q:
        term = q.strip()
        queryset = queryset.filter(Q(name__icontains=term) | Q(public_id__icontains=term))
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
        application_submission_count=Count('jobs__applications', distinct=True),
        application_pair_count=Coalesce(
            Subquery(latest_application_pairs, output_field=IntegerField()),
            0,
        ),
        candidate_count=Count('jobs__applications__candidate', distinct=True),
        unviewed_application_count=Coalesce(
            Subquery(latest_unviewed, output_field=IntegerField()),
            0,
        ),
        unviewed_count=Coalesce(
            Subquery(latest_unviewed, output_field=IntegerField()),
            0,
        ),
        accepted_count=Coalesce(
            Subquery(latest_accepted, output_field=IntegerField()),
            0,
        ),
        last_activity_at=Coalesce(
            Subquery(latest_activity.values('occurred_at')[:1], output_field=DateTimeField()),
            F('updated_at'),
        ),
        last_activity_type=Subquery(latest_activity.values('event_type')[:1]),
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
    order_fields = {
        'newest': '-created_at',
        'oldest': 'created_at',
        'activity': '-last_activity_at',
        'name': 'name',
    }
    return queryset.order_by(order_fields.get(ordering, '-last_activity_at'), '-created_at')


def campaign_detail_queryset(user):
    return campaign_list_queryset(user)


def attach_campaign_candidate_previews(campaigns, *, limit=5):
    """Attach up to ``limit`` recent, unique candidate previews per campaign.

    The campaign list is paginated before this function runs. One query covers
    the entire page and Python trims each campaign's preview list, so the query
    count remains flat while duplicate submissions never duplicate an avatar.
    """
    campaign_ids = [campaign.pk for campaign in campaigns]
    previews_by_campaign = defaultdict(list)
    seen_candidates = defaultdict(set)
    for campaign in campaigns:
        campaign.candidate_previews = []
    if not campaign_ids:
        return campaigns

    preview_rows = (
        Application.objects.filter(job__campaign_id__in=campaign_ids)
        .order_by('job__campaign_id', '-applied_at', '-id')
        .values(
            'job__campaign_id',
            'candidate_id',
            'candidate__public_id',
            'candidate__full_name',
            'candidate__avatar_url',
        )
    )
    remaining_campaigns = set(campaign_ids)
    for row in preview_rows:
        campaign_id = row['job__campaign_id']
        candidate_id = row['candidate_id']
        if candidate_id in seen_candidates[campaign_id]:
            continue
        seen_candidates[campaign_id].add(candidate_id)
        previews_by_campaign[campaign_id].append(
            {
                'public_id': row['candidate__public_id'],
                'full_name': row['candidate__full_name'] or 'Ứng viên',
                'avatar_url': row['candidate__avatar_url'],
            }
        )
        if len(previews_by_campaign[campaign_id]) >= limit:
            remaining_campaigns.discard(campaign_id)
            if not remaining_campaigns:
                break

    for campaign in campaigns:
        campaign.candidate_previews = previews_by_campaign[campaign.pk]
    return campaigns


def owned_campaign_queryset(user):
    """Lean tenant-scoped campaign query for campaign endpoints."""
    return RecruitmentCampaign.objects.filter(owner__user=user)


def campaign_options(user):
    return campaign_list_queryset(user).exclude(
        status__in=[RecruitmentCampaign.Status.COMPLETED, RecruitmentCampaign.Status.CANCELLED]
    )


def campaign_report(campaign):
    applications = Application.objects.filter(job__campaign=campaign)
    latest_application_id = (
        Application.objects.filter(
            job__campaign=campaign,
            candidate_id=OuterRef('candidate_id'),
            job_id=OuterRef('job_id'),
        )
        .order_by('-applied_at', '-id')
        .values('id')[:1]
    )
    latest_applications = applications.filter(id=Subquery(latest_application_id))
    statuses = {state: 0 for state in Application.Status.values}
    statuses.update(
        {
            row['status']: row['count']
            for row in latest_applications.values('status').annotate(count=Count('id'))
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
        'candidate_count': applications.values('candidate_id').distinct().count(),
        'application_submission_count': applications.count(),
        'application_pair_count': latest_applications.count(),
        'unviewed_count': statuses[Application.Status.SUBMITTED],
        'unanswered_count': sum(
            statuses[state]
            for state in (
                Application.Status.SUBMITTED,
                Application.Status.VIEWED,
                Application.Status.CONSIDERING,
            )
        ),
        'accepted_count': latest_applications.filter(status=Application.Status.ACCEPTED)
        .values('candidate_id')
        .distinct()
        .count(),
        'jobs': {
            'total': total_jobs,
            **job_statuses,
            'expired': expired_jobs,
            'views': sum(jobs.values_list('view_count', flat=True)),
        },
        'applications': {
            'total': applications.count(),
            'latest_total': sum(statuses.values()),
            'candidate_count': applications.values('candidate_id').distinct().count(),
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


def campaign_activity_queryset(campaign, *, group=None):
    queryset = campaign.activities.select_related('actor')
    if group:
        queryset = queryset.filter(group=group)
    return queryset.order_by('-occurred_at', '-id')


def campaign_pause_impact(campaign):
    today = timezone.localdate()
    active_jobs = campaign.jobs.filter(status=Job.Status.ACTIVE).filter(
        Q(deadline__isnull=True) | Q(deadline__gte=today)
    )
    return {
        'campaign_public_id': campaign.public_id,
        'campaign_name': campaign.name,
        'confirmation_code': campaign.public_id,
        'active_public_job_count': active_jobs.count(),
        'active_public_jobs': list(
            active_jobs.order_by('-created_at').values('public_id', 'title', 'deadline')[:10]
        ),
        'active_services': [],
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

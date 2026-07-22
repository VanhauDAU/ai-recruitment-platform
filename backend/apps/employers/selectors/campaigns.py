from datetime import timedelta

from django.db.models import Count, OuterRef, Q, Subquery
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.applications.models import Application
from apps.jobs.models import Job

from ..models import RecruiterProfile, RecruitmentCampaign


def campaign_list_queryset(user, *, status=None, scope=None, q=None):
    today = timezone.localdate()
    campaign_job = Job.objects.filter(campaign_id=OuterRef('pk')).order_by('-created_at')
    queryset = RecruitmentCampaign.objects.filter(owner__user=user).select_related(
        'position_category'
    )
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
        job_public_id=Subquery(campaign_job.values('public_id')[:1]),
        job_title=Subquery(campaign_job.values('title')[:1]),
        job_status=Subquery(campaign_job.values('status')[:1]),
        job_deadline=Subquery(campaign_job.values('deadline')[:1]),
        job_application_count=Subquery(campaign_job.values('application_count')[:1]),
        job_view_count=Subquery(campaign_job.values('view_count')[:1]),
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


def campaign_suggestions(user):
    recruiter = RecruiterProfile.objects.filter(user=user).first()
    if recruiter is None:
        return []
    return recruiter.recruitment_needs.filter(
        is_active=True, campaigns__isnull=True
    ).select_related('position_category')


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
        'headcount_target': campaign.headcount_target,
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

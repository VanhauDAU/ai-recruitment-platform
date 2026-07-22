from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.applications.models import Application

from ..models import RecruiterProfile, RecruitmentCampaign


def campaign_list_queryset(user, *, status=None, q=None):
    queryset = RecruitmentCampaign.objects.filter(owner__user=user).select_related(
        'position_category'
    )
    if status:
        queryset = queryset.filter(status=status)
    if q:
        queryset = queryset.filter(name__icontains=q.strip())
    return queryset.annotate(
        job_count=Count('jobs', distinct=True),
        application_count=Count('jobs__applications', distinct=True),
        accepted_count=Count(
            'jobs__applications',
            filter=Q(jobs__applications__status=Application.Status.ACCEPTED),
            distinct=True,
        ),
    ).order_by('-created_at')


def campaign_detail_queryset(user):
    return campaign_list_queryset(user).prefetch_related('jobs')


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
    statuses = {
        state: applications.filter(status=state).count() for state in Application.Status.values
    }
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
    return {
        'campaign_public_id': campaign.public_id,
        'headcount_target': campaign.headcount_target,
        'accepted_count': statuses[Application.Status.ACCEPTED],
        'jobs': {
            'total': jobs.count(),
            'draft': jobs.filter(status='draft').count(),
            'active': jobs.filter(status='active').count(),
            'closed': jobs.filter(status='closed').count(),
            'views': sum(jobs.values_list('view_count', flat=True)),
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

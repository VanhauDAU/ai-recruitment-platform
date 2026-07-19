"""Cross-domain read model for the employer workspace dashboard."""

from datetime import timedelta

from django.db.models import Count, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from apps.applications.models import Application
from apps.employers.models import RecruiterProfile
from apps.employers.selectors import build_employer_onboarding_steps
from apps.jobs.models import Job


def _summary(jobs, applications):
    job_counts = jobs.aggregate(
        total=Count('id'),
        active=Count('id', filter=Q(status=Job.Status.ACTIVE)),
        pending=Count('id', filter=Q(status=Job.Status.PENDING)),
        draft=Count('id', filter=Q(status=Job.Status.DRAFT)),
        views=Coalesce(Sum('view_count'), Value(0)),
    )
    application_counts = applications.aggregate(
        total=Count('id'),
        new=Count('id', filter=Q(status=Application.Status.SUBMITTED)),
        shortlisted=Count('id', filter=Q(status=Application.Status.SHORTLISTED)),
        interviewed=Count('id', filter=Q(status=Application.Status.INTERVIEWED)),
    )
    return {
        'jobs_total': job_counts['total'],
        'jobs_active': job_counts['active'],
        'jobs_pending': job_counts['pending'],
        'jobs_draft': job_counts['draft'],
        'job_views': job_counts['views'],
        'applications_total': application_counts['total'],
        'applications_new': application_counts['new'],
        'applications_shortlisted': application_counts['shortlisted'],
        'applications_interviewed': application_counts['interviewed'],
    }


def _application_activity(applications):
    today = timezone.localdate()
    start = today - timedelta(days=6)
    daily = {
        item['day']: item['count']
        for item in applications.filter(applied_at__date__gte=start)
        .annotate(day=TruncDate('applied_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    }
    return [
        {'date': (start + timedelta(days=offset)), 'count': daily.get(start + timedelta(days=offset), 0)}
        for offset in range(7)
    ]


def _recent_jobs(jobs):
    return [
        {
            'public_id': job.public_id,
            'title': job.title,
            'status': job.status,
            'status_label': job.get_status_display(),
            'deadline': job.deadline,
            'application_count': job.application_count,
            'view_count': job.view_count,
            'published_at': job.published_at,
            'created_at': job.created_at,
        }
        for job in jobs.order_by('-created_at')[:5]
    ]


def _recent_applications(applications):
    return [
        {
            'public_id': application.public_id,
            'candidate_name': application.candidate.full_name or application.candidate.email,
            'job_public_id': application.job.public_id,
            'job_title': application.job.title,
            'submitted_cv_title': application.submitted_cv_title,
            'status': application.status,
            'status_label': application.get_status_display(),
            'applied_at': application.applied_at,
        }
        for application in applications.select_related('candidate', 'job').order_by('-applied_at')[:5]
    ]


def build_employer_dashboard(user):
    recruiter = RecruiterProfile.objects.select_related(
        'user', 'company', 'work_location',
    ).prefetch_related('recruitment_needs__position_category').get(user=user)
    jobs = Job.objects.filter(posted_by=user)
    applications = Application.objects.filter(job__posted_by=user)
    verification = build_employer_onboarding_steps(recruiter)
    company = recruiter.company if verification['company_linked'] else None
    need = next(iter(recruiter.recruitment_needs.all()), None)

    return {
        'account': {
            'recruiter_public_id': recruiter.public_id,
            'company_public_id': company.public_id if company else None,
            'company_name': company.company_name if company else '',
            'company_verification_status': company.verification_status if company else 'unverified',
            'company_size': company.company_size if company else '',
            'work_location_name': recruiter.work_location.name if recruiter.work_location_id else '',
            'verification': verification,
        },
        'summary': _summary(jobs, applications),
        'application_activity': _application_activity(applications),
        'recruitment_need': None if need is None else {
            'position_category_name': need.position_category.name,
            'position_level': need.position_level,
            'position_level_label': need.get_position_level_display(),
            'target_date': need.target_date,
            'is_continuous': need.is_continuous,
            'headcount': need.headcount,
        },
        'recent_jobs': _recent_jobs(jobs),
        'recent_applications': _recent_applications(applications),
    }

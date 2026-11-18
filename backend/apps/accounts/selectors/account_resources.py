"""Per-account resource lists shown on the admin account detail tabs."""

from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count


def account_cvs_queryset(user):
    return (
        user.cvs.filter(is_deleted=False).select_related('template').order_by('-updated_at', '-id')
    )


def account_applications_queryset(user):
    return user.applications.select_related(
        'job__company',
        'submitted_cv_version',
    ).order_by('-applied_at', '-id')


def account_consents_queryset(user):
    try:
        return user.candidate_profile.consents.order_by('consent_type')
    except ObjectDoesNotExist:
        return user.applications.none()


def account_recruitment_needs_queryset(user):
    try:
        return user.recruiter_profile.recruitment_needs.select_related(
            'position_category'
        ).order_by('-updated_at', '-id')
    except ObjectDoesNotExist:
        return user.posted_jobs.none()


def account_jobs_queryset(user):
    return user.posted_jobs.select_related('company', 'campaign').order_by('-updated_at', '-id')


def account_campaigns_queryset(user):
    try:
        return user.recruiter_profile.campaigns.annotate(
            job_count=Count('jobs', distinct=True),
            application_count=Count('jobs__applications', distinct=True),
        ).order_by('-updated_at', '-id')
    except ObjectDoesNotExist:
        return user.posted_jobs.none()

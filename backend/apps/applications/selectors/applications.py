"""Read queries for job applications."""

from datetime import timedelta

from django.db.models import (
    CharField,
    Count,
    Exists,
    F,
    Func,
    IntegerField,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Value,
)
from django.db.models.functions import Cast, Coalesce, Concat
from django.utils import timezone

from apps.candidates.models import CandidateNotification

from ..models import (
    Application,
    ApplicationReminder,
    ApplicationReview,
    ApplicationReviewLink,
    ApplicationStatusHistory,
    CandidateBlock,
    TalentPoolEntry,
)


def _history_notice():
    """Candidate notice scheduled by the outer history row (same dedupe key)."""
    return CandidateNotification.objects.filter(
        recipient_id=OuterRef('application__candidate_id'),
        dedupe_key=Concat(
            Value(ApplicationStatusHistory.NOTIFICATION_KEY_PREFIX),
            Cast(OuterRef('pk'), CharField()),
        ),
    )


def candidate_published_history_queryset():
    """History the candidate may see: undone rows and notices not yet
    delivered (inside the recruiter's undo window) stay hidden."""
    return ApplicationStatusHistory.objects.filter(reverted_at__isnull=True).exclude(
        Exists(_history_notice().filter(delivered_at__isnull=True))
    )


def candidate_applications_queryset(candidate):
    return (
        Application.objects.filter(candidate=candidate)
        .select_related('job', 'job__company', 'cv', 'submitted_cv_version')
        .prefetch_related(
            'preferred_locations',
            Prefetch('status_history', queryset=candidate_published_history_queryset()),
            'reminders',
        )
        .order_by('-applied_at')
    )


def _recent_jobs_applied_count():
    """Distinct jobs of the same recruiter the candidate applied to recently."""
    since = timezone.now() - timedelta(days=CandidateBlock.MASS_APPLY_WINDOW_DAYS)
    return (
        Application.objects.filter(
            candidate_id=OuterRef('candidate_id'),
            job__posted_by_id=OuterRef('job__posted_by_id'),
            applied_at__gte=since,
        )
        .order_by()
        .values('candidate_id')
        .annotate(jobs=Count('job_id', distinct=True))
        .values('jobs')[:1]
    )


def employer_applications_queryset(
    employer,
    job_public_id=None,
    *,
    status=None,
    campaign=None,
    q=None,
    scope=None,
    ordering=None,
):
    # Recruiters work on the current application only; replaced ones are history.
    queryset = (
        Application.objects.filter(job__posted_by=employer, is_current=True)
        .select_related(
            'candidate',
            'job',
            'cv',
            'submitted_cv_version',
            'submitted_cv_version__template_version',
        )
        .prefetch_related(
            'preferred_locations',
        )
        .annotate(
            candidate_blocked=Exists(
                CandidateBlock.objects.filter(
                    CandidateBlock.active_q(),
                    recruiter_id=OuterRef('job__posted_by_id'),
                    candidate_id=OuterRef('candidate_id'),
                )
            ),
            in_talent_pool=Exists(
                TalentPoolEntry.objects.filter(
                    TalentPoolEntry.active_q(),
                    recruiter_id=OuterRef('job__posted_by_id'),
                    candidate_id=OuterRef('candidate_id'),
                )
            ),
            # Ordinal of this submission for the candidate and job ("Lần N").
            submission_number=Subquery(
                Application.objects.filter(
                    candidate_id=OuterRef('candidate_id'),
                    job_id=OuterRef('job_id'),
                    applied_at__lte=OuterRef('applied_at'),
                )
                .order_by()
                .annotate(total=Func(F('id'), function='COUNT'))
                .values('total'),
                output_field=IntegerField(),
            ),
            last_reminded_at=Subquery(
                ApplicationReminder.objects.filter(application_id=OuterRef('pk'))
                .order_by('-created_at')
                .values('created_at')[:1]
            ),
            recent_jobs_applied=Coalesce(
                Subquery(_recent_jobs_applied_count(), output_field=IntegerField()), 0
            ),
        )
    )
    if job_public_id:
        queryset = queryset.filter(job__public_id=job_public_id)
    if status:
        queryset = queryset.filter(status=status)
    if campaign:
        queryset = queryset.filter(job__campaign__public_id=campaign)
    if q:
        queryset = queryset.filter(
            Q(candidate__full_name__icontains=q)
            | Q(candidate__email__icontains=q)
            | Q(job__title__icontains=q)
            | Q(submitted_cv_title__icontains=q)
        )
    if scope == 'unread':
        queryset = queryset.filter(status=Application.Status.SUBMITTED)
    elif scope == 'unanswered':
        queryset = queryset.filter(status__in=Application.UNANSWERED_STATUSES)
    order_fields = {
        'oldest': 'applied_at',
        'name': 'candidate__full_name',
        'newest': '-applied_at',
    }
    return queryset.order_by(order_fields.get(ordering, '-applied_at'), '-id')


def recruiter_application_history_queryset(application):
    """Status history with the delivery state of the notice each row scheduled."""
    notice = _history_notice()
    return (
        application.status_history.select_related('changed_by')
        .annotate(
            notice_deliver_after=Subquery(notice.values('deliver_after')[:1]),
            notice_delivered_at=Subquery(notice.values('delivered_at')[:1]),
            notice_cancel_reason=Subquery(notice.values('cancel_reason')[:1]),
            notice_email_sent_at=Subquery(notice.values('email_sent_at')[:1]),
        )
        .order_by('created_at', 'id')
    )


def employer_application_queryset(employer):
    """Applications an employer is authorised to update."""
    return Application.objects.filter(job__posted_by=employer)


def admin_job_applications_queryset(job, *, params=None):
    """Return read-only application records for one job moderation workspace."""
    params = params or {}
    queryset = (
        Application.objects.filter(job=job)
        .select_related('candidate', 'job', 'submitted_cv_version')
        .prefetch_related('preferred_locations')
    )

    if query := (params.get('q') or '').strip():
        queryset = queryset.filter(
            Q(candidate__full_name__icontains=query)
            | Q(candidate__email__icontains=query)
            | Q(contact_name__icontains=query)
            | Q(contact_email__icontains=query)
            | Q(contact_phone__icontains=query)
            | Q(submitted_cv_title__icontains=query)
        )
    if status_values := [value for value in (params.get('status') or '').split(',') if value]:
        queryset = queryset.filter(status__in=status_values)
    if source := params.get('source'):
        queryset = queryset.filter(source=source)
    if submitted_from := params.get('submitted_from'):
        queryset = queryset.filter(applied_at__date__gte=submitted_from)
    if submitted_to := params.get('submitted_to'):
        queryset = queryset.filter(applied_at__date__lte=submitted_to)

    ordering = {
        'oldest': 'applied_at',
        'name': 'candidate__full_name',
        'status': 'status',
        'newest': '-applied_at',
    }.get(params.get('ordering'), '-applied_at')
    return queryset.order_by(ordering, '-id')


def recruiter_application_snapshot_queryset(recruiter):
    """Snapshots are private to the recruiter who posted the job."""
    return (
        Application.objects.filter(
            Q(job__posted_by=recruiter),
            submitted_cv_version__version_kind='application_snapshot',
        )
        .select_related(
            'candidate',
            'job',
            'job__company',
            'submitted_cv_version',
            'submitted_cv_version__template_version',
            'submitted_cv_version__parent_version',
        )
        .prefetch_related('preferred_locations')
        .distinct()
    )


def recruiter_review_links_queryset(application):
    return (
        ApplicationReviewLink.objects.filter(application=application)
        .select_related('review')
        .order_by('-created_at', '-id')
    )


def recruiter_reviews_queryset(application):
    return (
        ApplicationReview.objects.filter(application=application)
        .select_related('link')
        .order_by('-submitted_at', '-id')
    )


def recruiter_candidate_blocks_queryset(recruiter):
    return (
        CandidateBlock.objects.filter(recruiter=recruiter, lifted_at__isnull=True)
        .select_related('candidate', 'source_application__job')
        .order_by('-created_at', '-id')
    )


def previous_submissions_queryset(application):
    """Earlier submissions to the same job, replaced by ``application``; read-only."""
    return Application.objects.filter(
        candidate_id=application.candidate_id,
        job_id=application.job_id,
        is_current=False,
    ).order_by('-applied_at', '-id')

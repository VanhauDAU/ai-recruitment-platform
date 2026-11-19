"""Cross-domain read model for the admin portal home dashboard.

Every block is a fixed number of aggregate queries, so the cost does not grow
with the size of the platform. Queue counts reuse the domain summaries that
feed the admin sidebar badges, so the two surfaces never disagree.
"""

from datetime import timedelta

from django.db.models import (
    Avg,
    Count,
    DurationField,
    Exists,
    ExpressionWrapper,
    F,
    Min,
    OuterRef,
    Q,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from apps.accounts.models import User
from apps.ai_core.models import AiUsageDaily
from apps.applications.models import Application
from apps.blog.models import Post, PostWorkingCopy
from apps.employers.models import (
    ADMIN_PENDING_COMPANY_UPDATE_STATUSES,
    CompanyDomainClaim,
    CompanyReport,
    CompanyUpdateRequest,
    EmployerComplianceHold,
    EmployerVerificationCase,
)
from apps.employers.selectors import (
    admin_company_summary,
    admin_verification_summary,
    pending_join_requests_awaiting_admin,
    unreviewed_content_changes,
)
from apps.jobs.models import (
    Job,
    JobCategory,
    JobCategoryAssignment,
    JobReport,
    JobState,
    job_effective_state_expression,
)
from apps.jobs.selectors import admin_job_management_summary
from apps.knowledgebase.models import KnowledgeArticleRevision
from apps.knowledgebase.selectors import admin_article_summary
from apps.matching.models import MatchAnalysis
from common.vietnam_time import VIETNAM_TZ, vietnam_day_start, vietnam_today

DASHBOARD_PERIODS = (7, 30, 90)
DEFAULT_DASHBOARD_PERIOD = 30
TOP_CATEGORY_LIMIT = 6
EXPIRING_SOON_DAYS = 7
STALE_APPLICATION_DAYS = 7
# Service levels used to flag a queue item as overdue. Verification keeps the
# 72h SLA already enforced by its own summary; reports affect candidate safety
# so they get a tighter target.
QUEUE_SLA_HOURS = {
    'recruiter_verification': 72,
    'domain_verification': 72,
    'company_updates': 72,
    'company_join_requests': 72,
    # Page content is already public when it lands here (post-moderation).
    'company_content_changes': 48,
    'job_reports': 48,
    'company_reports': 48,
    'job_resubmissions': 48,
    'blog_reviews': 72,
    'knowledge_reviews': 72,
}


def _window(days):
    today = vietnam_today()
    start_day = today - timedelta(days=days - 1)
    previous_start_day = start_day - timedelta(days=days)
    return {
        'days': days,
        'start_day': start_day,
        'end_day': today,
        'start': vietnam_day_start(start_day),
        'previous_start': vietnam_day_start(previous_start_day),
    }


def _in_period(field, window):
    return Q(**{f'{field}__gte': window['start']})


def _in_previous(field, window):
    return Q(**{f'{field}__gte': window['previous_start'], f'{field}__lt': window['start']})


def _compare(queryset, field, window, base_filter=None):
    base = base_filter or Q()
    return queryset.aggregate(
        current=Count('id', filter=base & _in_period(field, window)),
        previous=Count('id', filter=base & _in_previous(field, window)),
    )


def _overdue_before(key, now):
    return now - timedelta(hours=QUEUE_SLA_HOURS[key])


def _queue(key, queryset, field, now, *, count=None):
    data = queryset.aggregate(
        count=Count('id', distinct=True),
        overdue=Count('id', filter=Q(**{f'{field}__lt': _overdue_before(key, now)}), distinct=True),
        oldest_at=Min(field),
    )
    return {
        'key': key,
        'count': data['count'] if count is None else count,
        'overdue': data['overdue'],
        'oldest_at': data['oldest_at'],
        'sla_hours': QUEUE_SLA_HOURS[key],
    }


def _queues(now, job_summary):
    verification = admin_verification_summary()
    knowledge = admin_article_summary()
    company = admin_company_summary()
    pending_verification = Q(
        status__in=[
            EmployerVerificationCase.Status.PENDING,
            EmployerVerificationCase.Status.IN_REVIEW,
        ]
    )

    queues = [
        {
            **_queue(
                'recruiter_verification',
                EmployerVerificationCase.objects.filter(pending_verification),
                'submitted_at',
                now,
            ),
            # Badge parity: the domain summary also counts re-uploaded documents.
            'count': verification['pending'],
            'overdue': verification['overdue'],
        },
        _queue(
            'domain_verification',
            CompanyDomainClaim.objects.filter(
                status=CompanyDomainClaim.Status.PENDING,
                method=CompanyDomainClaim.Method.ADMIN_MANUAL,
                manual_review_requested_at__isnull=False,
            ),
            'manual_review_requested_at',
            now,
        ),
        _queue(
            'company_updates',
            CompanyUpdateRequest.objects.filter(status__in=ADMIN_PENDING_COMPANY_UPDATE_STATUSES),
            'submitted_at',
            now,
            count=company['pending_update_requests'],
        ),
        # Requests nobody but an administrator can decide (no eligible owner).
        _queue(
            'company_join_requests',
            pending_join_requests_awaiting_admin(),
            'created_at',
            now,
        ),
        _queue('company_content_changes', unreviewed_content_changes(), 'created_at', now),
        _queue(
            'job_reports',
            JobReport.objects.filter(status=JobReport.Status.PENDING),
            'created_at',
            now,
            count=job_summary['pending_reports'],
        ),
        _queue(
            'company_reports',
            CompanyReport.objects.filter(status=CompanyReport.Status.PENDING),
            'created_at',
            now,
        ),
        _queue(
            'job_resubmissions',
            Job.objects.filter(
                moderation_hold=Job.ModerationHold.CHANGES_REQUESTED,
                moderation_resubmitted_at__isnull=False,
            ),
            'moderation_resubmitted_at',
            now,
            count=job_summary['resubmitted'],
        ),
    ]
    pending_posts = _queue(
        'blog_reviews',
        Post.objects.filter(status=Post.Status.PENDING),
        'submitted_at',
        now,
    )
    # A published post can carry a pending working copy (an edit awaiting review).
    pending_copies = _queue(
        'blog_reviews',
        PostWorkingCopy.objects.filter(
            status=PostWorkingCopy.Status.PENDING, post__status=Post.Status.PUBLISHED
        ),
        'submitted_at',
        now,
    )
    queues.append(
        {
            **pending_posts,
            'count': pending_posts['count'] + pending_copies['count'],
            'overdue': pending_posts['overdue'] + pending_copies['overdue'],
            'oldest_at': min(
                filter(None, [pending_posts['oldest_at'], pending_copies['oldest_at']]),
                default=None,
            ),
        }
    )
    queues.append(
        _queue(
            'knowledge_reviews',
            KnowledgeArticleRevision.objects.filter(
                status=KnowledgeArticleRevision.Status.IN_REVIEW
            ),
            'submitted_at',
            now,
            count=knowledge['in_review'],
        )
    )
    return queues, {
        'companies': company['total'],
        'knowledge_review_overdue': knowledge['overdue'],
    }


def _activity_series(window):
    start = window['start']

    def daily(queryset, field):
        return {
            row['day']: row['count']
            for row in queryset.filter(**{f'{field}__gte': start})
            .annotate(day=TruncDate(field, tzinfo=VIETNAM_TZ))
            .values('day')
            .annotate(count=Count('id'))
            .order_by()
        }

    users = User.objects.filter(is_deleted=False)
    metrics = {
        'candidates': daily(users.filter(role=User.Role.CANDIDATE), 'date_joined'),
        'employers': daily(users.filter(role=User.Role.EMPLOYER), 'date_joined'),
        'jobs': daily(Job.objects.all(), 'published_at'),
        # Every submission counts on its own day; a later resubmission must not
        # rewrite the past. The funnel and backlog keep to current ones.
        'applications': daily(Application.objects.all(), 'applied_at'),
    }
    series = []
    for offset in range(window['days']):
        day = window['start_day'] + timedelta(days=offset)
        series.append({'date': day, **{key: values.get(day, 0) for key, values in metrics.items()}})
    return series


def _kpis(window):
    users = User.objects.filter(is_deleted=False)
    return {
        'candidates': _compare(users, 'date_joined', window, Q(role=User.Role.CANDIDATE)),
        'employers': _compare(users, 'date_joined', window, Q(role=User.Role.EMPLOYER)),
        'jobs': _compare(Job.objects.all(), 'published_at', window),
        'applications': _compare(Application.objects.all(), 'applied_at', window),
    }


def _applications(window, now):
    current = Application.objects.filter(is_current=True)
    funnel = current.filter(_in_period('applied_at', window)).aggregate(
        submitted=Count('id'),
        viewed=Count('id', filter=Q(viewed_at__isnull=False)),
        shortlisted=Count('id', filter=Q(shortlisted_at__isnull=False)),
        interviewed=Count('id', filter=Q(interviewed_at__isnull=False)),
        accepted=Count('id', filter=Q(accepted_at__isnull=False)),
        rejected=Count('id', filter=Q(status=Application.Status.REJECTED)),
        withdrawn=Count('id', filter=Q(status=Application.Status.WITHDRAWN)),
        avg_first_view=Avg(
            ExpressionWrapper(F('viewed_at') - F('applied_at'), output_field=DurationField()),
            filter=Q(viewed_at__isnull=False),
        ),
    )
    avg_first_view = funnel.pop('avg_first_view')
    # Unanswered (new or only viewed) for a week, counted from the submission.
    stale = current.filter(
        status__in=Application.UNANSWERED_STATUSES,
        applied_at__lt=now - timedelta(days=STALE_APPLICATION_DAYS),
    ).count()
    return {
        'funnel': funnel,
        'avg_first_view_hours': (
            round(avg_first_view.total_seconds() / 3600, 1) if avg_first_view else None
        ),
        'stale_unviewed': stale,
    }


def _jobs(job_summary):
    today = vietnam_today()
    active = Job.objects.alias(
        effective_state=job_effective_state_expression(),
        has_application=Exists(Application.objects.filter(job_id=OuterRef('pk'), is_current=True)),
    ).filter(effective_state=JobState.ACTIVE)
    extra = active.aggregate(
        without_applications=Count('id', filter=~Q(has_application=True)),
        expiring_soon=Count(
            'id',
            filter=Q(deadline__gte=today, deadline__lte=today + timedelta(days=EXPIRING_SOON_DAYS)),
        ),
    )
    return {
        'states': {state: job_summary[state] for state in JobState.values},
        'held': job_summary['held'],
        **extra,
    }


def _trust(window):
    def reports(model):
        return model.objects.aggregate(
            new=Count('id', filter=_in_period('created_at', window)),
            upheld=Count(
                'id',
                filter=_in_period('resolved_at', window) & Q(status=model.Status.UPHELD),
            ),
            dismissed=Count(
                'id',
                filter=_in_period('resolved_at', window) & Q(status=model.Status.DISMISSED),
            ),
        )

    restricted = User.objects.filter(
        is_deleted=False, status__in=[User.Status.INACTIVE, User.Status.BANNED]
    ).aggregate(
        candidates=Count('id', filter=Q(role=User.Role.CANDIDATE)),
        employers=Count('id', filter=Q(role=User.Role.EMPLOYER)),
    )
    return {
        'job_reports': reports(JobReport),
        'company_reports': reports(CompanyReport),
        'restricted_accounts': restricted,
        'compliance_holds_active': EmployerComplianceHold.objects.filter(
            status=EmployerComplianceHold.Status.ACTIVE
        ).count(),
    }


def _totals(companies, job_summary):
    users = User.objects.filter(is_deleted=False).aggregate(
        candidates=Count('id', filter=Q(role=User.Role.CANDIDATE)),
        employers=Count('id', filter=Q(role=User.Role.EMPLOYER)),
    )
    return {**users, 'companies': companies, 'jobs_active': job_summary[JobState.ACTIVE]}


def _top_categories(window):
    active_jobs = (
        Job.objects.alias(effective_state=job_effective_state_expression())
        .filter(effective_state=JobState.ACTIVE)
        .values('id')
    )
    primary = Q(job_assignments__role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION)
    rows = (
        JobCategory.objects.annotate(
            active_jobs=Count(
                'job_assignments__job',
                filter=primary & Q(job_assignments__job__in=active_jobs),
                distinct=True,
            ),
            applications=Count(
                'job_assignments__job__applications',
                filter=primary
                & Q(
                    job_assignments__job__applications__is_current=True,
                    job_assignments__job__applications__applied_at__gte=window['start'],
                ),
                distinct=True,
            ),
        )
        .filter(active_jobs__gt=0)
        .order_by('-active_jobs', '-applications', 'name')
        .values('public_id', 'name', 'active_jobs', 'applications')[:TOP_CATEGORY_LIMIT]
    )
    return list(rows)


def _ai(window):
    analyses = MatchAnalysis.objects.filter(_in_period('created_at', window)).aggregate(
        total=Count('id'),
        succeeded=Count('id', filter=Q(status=MatchAnalysis.Status.SUCCEEDED)),
        failed=Count('id', filter=Q(status=MatchAnalysis.Status.FAILED)),
    )
    zero = Value(0)
    usage = AiUsageDaily.objects.filter(date__gte=window['start_day']).aggregate(
        invocations=Coalesce(Sum('invocation_count'), zero),
        failures=Coalesce(Sum('failure_count'), zero),
        total_tokens=Coalesce(Sum('total_tokens'), zero),
        latency_ms=Coalesce(Sum('total_latency_ms'), zero),
        cost_usd=Sum('cost_usd'),
    )
    latency_ms = usage.pop('latency_ms')
    return {
        'match_analyses': analyses,
        'generation': {
            **usage,
            'cost_usd': usage['cost_usd'] or 0,
            'avg_latency_ms': (
                round(latency_ms / usage['invocations']) if usage['invocations'] else None
            ),
        },
    }


def normalize_dashboard_period(raw):
    try:
        days = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_DASHBOARD_PERIOD
    return days if days in DASHBOARD_PERIODS else DEFAULT_DASHBOARD_PERIOD


def build_admin_dashboard(*, days=DEFAULT_DASHBOARD_PERIOD):
    now = timezone.now()
    window = _window(days)
    job_summary = admin_job_management_summary()
    queues, extra = _queues(now, job_summary)
    return {
        'generated_at': now,
        'period': {
            'days': window['days'],
            'start': window['start_day'],
            'end': window['end_day'],
        },
        'queues': queues,
        'kpis': _kpis(window),
        'activity': _activity_series(window),
        'totals': _totals(extra['companies'], job_summary),
        'jobs': _jobs(job_summary),
        'applications': _applications(window, now),
        'trust': _trust(window),
        'content': {'knowledge_review_overdue': extra['knowledge_review_overdue']},
        'top_categories': _top_categories(window),
        'ai': _ai(window),
    }


def build_admin_queue_summary():
    """Queue counts only: cheap enough for the admin shell to poll for badges."""
    now = timezone.now()
    queues, extra = _queues(now, admin_job_management_summary())
    return {
        'generated_at': now,
        'queues': queues,
        'knowledge_review_overdue': extra['knowledge_review_overdue'],
    }

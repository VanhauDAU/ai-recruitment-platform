"""Administrator account directory: list, summary, sessions and invitations."""

import re
from datetime import timedelta

from django.db.models import (
    BooleanField,
    Case,
    CharField,
    Count,
    Exists,
    F,
    IntegerField,
    Max,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Value,
    When,
)
from django.utils import timezone

from apps.employers.models import (
    CompanyDocument,
    CompanyUpdateRequest,
    EmployerVerificationCase,
    RecruitmentNeed,
)
from apps.sitecontent.selectors import moderation_sla_hours
from common.api.params import parse_bool
from common.db.search import search_q

from ..domain import recruiter_next_action as next_action
from ..models import (
    AdminInvitation,
    AuthSession,
    User,
)

ACCOUNT_SCOPE_USERS = 'users'


ACCOUNT_SCOPE_RECRUITERS = 'recruiters'


ACCOUNT_SCOPES = frozenset({ACCOUNT_SCOPE_USERS, ACCOUNT_SCOPE_RECRUITERS})


def _with_recruiter_initial_onboarding(queryset):
    """Annotate the three-step employer setup state without per-row queries."""
    return queryset.annotate(
        _has_recruitment_need=Exists(
            RecruitmentNeed.objects.filter(recruiter__user_id=OuterRef('pk'))
        ),
    ).annotate(
        recruiter_initial_onboarding_completed=Case(
            When(
                role=User.Role.EMPLOYER,
                recruiter_profile__registration_completed_at__isnull=False,
                email_verified=True,
                _has_recruitment_need=True,
                then=Value(True),
            ),
            default=Value(False),
            output_field=BooleanField(),
        )
    )


# Company update requests an admin still has to review (changes_requested waits
# on the recruiter, so it is not admin work).
ADMIN_COMPANY_UPDATE_STATUSES = (
    CompanyUpdateRequest.Status.PENDING,
    CompanyUpdateRequest.Status.SUBMITTED,
    CompanyUpdateRequest.Status.IN_REVIEW,
)
_ACTIONABLE_CASE_STATUSES = (
    EmployerVerificationCase.Status.PENDING,
    EmployerVerificationCase.Status.IN_REVIEW,
)
_RESUBMISSION_CASE_STATUSES = (
    EmployerVerificationCase.Status.CHANGES_REQUESTED,
    EmployerVerificationCase.Status.REJECTED,
)


def _with_recruiter_next_action(queryset):
    """Annotate ``recruiter_next_action`` + ``recruiter_next_action_rank`` in SQL.

    Needs ``recruiter_initial_onboarding_completed``. Codes and ranks are owned
    by ``accounts.domain.recruiter_next_action``; the list filter, sorter and
    the summary tiles all read this one annotation so their numbers agree.
    """
    case = 'recruiter_profile__verification_case'
    actionable = Q(**{f'{case}__status__in': _ACTIONABLE_CASE_STATUSES}) | Q(
        _has_pending_document=True
    )
    overdue_before = timezone.now() - timedelta(hours=moderation_sla_hours())
    return (
        queryset.annotate(
            _has_pending_document=Exists(
                CompanyDocument.objects.filter(
                    verification_case__recruiter__user_id=OuterRef('pk'),
                    is_current=True,
                    status=CompanyDocument.Status.PENDING,
                )
            ),
            pending_company_update_public_id=Subquery(
                CompanyUpdateRequest.objects.filter(
                    requested_by_id=OuterRef('pk'),
                    status__in=ADMIN_COMPANY_UPDATE_STATUSES,
                )
                .order_by('submitted_at', 'id')
                .values('public_id')[:1]
            ),
        )
        .annotate(
            recruiter_next_action=Case(
                When(~Q(role=User.Role.EMPLOYER), then=Value(next_action.NONE)),
                When(
                    actionable & Q(**{f'{case}__submitted_at__lt': overdue_before}),
                    then=Value(next_action.VERIFICATION_OVERDUE),
                ),
                When(actionable, then=Value(next_action.VERIFICATION_REVIEW)),
                When(
                    pending_company_update_public_id__isnull=False,
                    then=Value(next_action.COMPANY_UPDATE_REVIEW),
                ),
                When(
                    status__in=[User.Status.INACTIVE, User.Status.BANNED],
                    then=Value(next_action.ACCOUNT_RESTRICTED),
                ),
                When(
                    **{f'{case}__status__in': _RESUBMISSION_CASE_STATUSES},
                    then=Value(next_action.AWAITING_RESUBMISSION),
                ),
                When(
                    Q(recruiter_profile__isnull=True) | Q(recruiter_profile__company__isnull=True),
                    then=Value(next_action.AWAITING_COMPANY),
                ),
                When(
                    recruiter_initial_onboarding_completed=False,
                    then=Value(next_action.AWAITING_ONBOARDING),
                ),
                When(
                    Q(**{f'{case}__isnull': True})
                    | Q(**{f'{case}__status': EmployerVerificationCase.Status.DRAFT}),
                    then=Value(next_action.AWAITING_SUBMISSION),
                ),
                default=Value(next_action.NONE),
                output_field=CharField(),
            )
        )
        .annotate(
            recruiter_next_action_rank=Case(
                *(
                    When(recruiter_next_action=code, then=Value(rank))
                    for code, rank in next_action.NEXT_ACTION_RANKS.items()
                ),
                output_field=IntegerField(),
            )
        )
    )


def _recruiter_search(query):
    """Name/email/id plus company name (accent-insensitive), tax code and phone."""
    condition = (
        Q(email__icontains=query)
        | Q(full_name__icontains=query)
        | Q(public_id__icontains=query)
        | search_q('recruiter_profile__company__company_name', query)
    )
    digits = re.sub(r'\D', '', query)
    if len(digits) >= 4:
        condition |= Q(recruiter_profile__company__tax_code__icontains=digits)
    if len(digits) >= 6:
        # Match the national part so 09xx…, 84 9xx… and +84 9xx… all hit.
        tail = digits[-9:]
        condition |= Q(phone__contains=tail) | Q(recruiter_profile__contact_phone__contains=tail)
    return condition


def _account_visibility(actor):
    """Superuser thấy mọi tài khoản; admin thường chỉ thấy ứng viên và NTD."""

    if actor.is_superuser:
        return Q()
    return Q(role__in=[User.Role.CANDIDATE, User.Role.EMPLOYER])


def accounts_queryset(actor, *, params=None):
    params = params or {}
    scope = params.get('scope', '').strip()
    queryset = _with_recruiter_initial_onboarding(
        User.objects.filter(is_deleted=False).filter(_account_visibility(actor))
    )
    if scope != ACCOUNT_SCOPE_USERS:
        queryset = _with_recruiter_next_action(queryset)
    if scope != ACCOUNT_SCOPE_RECRUITERS:
        queryset = queryset.select_related(
            'candidate_profile', 'candidate_profile__job_preference'
        ).prefetch_related(
            'social_accounts',
            'candidate_profile__job_preference__desired_specializations__job_category',
            'candidate_profile__job_preference__preferred_provinces__location',
        )
    queryset = (
        queryset.select_related(
            'recruiter_profile__company',
            'recruiter_profile__verification_case',
            'recruiter_profile__work_location',
        )
        .prefetch_related(
            Prefetch(
                'admin_invitations_received',
                queryset=AdminInvitation.objects.select_related('invited_by').order_by(
                    '-created_at'
                ),
                to_attr='account_admin_invitations',
            ),
            'recruiter_profile__company__company_industries__industry',
            Prefetch(
                'recruiter_profile__verification_case__documents',
                queryset=CompanyDocument.objects.filter(is_current=True),
                to_attr='current_documents_for_checks',
            ),
            Prefetch(
                'recruiter_profile__recruitment_needs',
                queryset=RecruitmentNeed.objects.only('id', 'recruiter_id'),
                to_attr='verification_recruitment_needs',
            ),
        )
        .annotate(
            active_session_count=Count(
                'auth_sessions',
                filter=Q(
                    auth_sessions__revoked_at__isnull=True,
                    auth_sessions__expires_at__gt=timezone.now(),
                ),
                distinct=True,
            ),
            last_session_seen_at=Max('auth_sessions__last_seen_at'),
        )
        .distinct()
    )
    if scope == ACCOUNT_SCOPE_USERS:
        queryset = queryset.filter(role__in=[User.Role.CANDIDATE, User.Role.ADMIN])
    elif scope == ACCOUNT_SCOPE_RECRUITERS:
        queryset = queryset.filter(role=User.Role.EMPLOYER)

    query = params.get('q', '').strip()
    if query and scope == ACCOUNT_SCOPE_RECRUITERS:
        queryset = queryset.filter(_recruiter_search(query))
    elif query:
        queryset = queryset.filter(
            Q(email__icontains=query)
            | Q(full_name__icontains=query)
            | Q(public_id__icontains=query)
        )
    if scope != ACCOUNT_SCOPE_USERS and (
        codes := next_action.next_action_codes(params.get('next_action'))
    ):
        queryset = queryset.filter(recruiter_next_action__in=codes)
    if params.get('role'):
        queryset = queryset.filter(role=params['role'])
    if params.get('status'):
        statuses = [value.strip() for value in params['status'].split(',') if value.strip()]
        queryset = queryset.filter(status__in=statuses)
    if (email_verified := parse_bool(params.get('email_verified'))) is not None:
        queryset = queryset.filter(email_verified=email_verified)
    if (has_session := parse_bool(params.get('has_active_session'))) is not None:
        queryset = queryset.filter(
            **({'active_session_count__gt': 0} if has_session else {'active_session_count': 0})
        )
    if params.get('company'):
        queryset = queryset.filter(recruiter_profile__company__public_id=params['company'])
    company_state = params.get('company_state', '').lower()
    if company_state == 'linked':
        queryset = queryset.filter(recruiter_profile__company__isnull=False)
    elif company_state == 'missing':
        queryset = queryset.filter(
            Q(recruiter_profile__isnull=True) | Q(recruiter_profile__company__isnull=True)
        )
    verification_status = params.get('verification_status', '')
    if verification_status == 'none':
        queryset = queryset.filter(recruiter_profile__verification_case__isnull=True)
    elif verification_status in EmployerVerificationCase.Status.values:
        queryset = queryset.filter(recruiter_profile__verification_case__status=verification_status)
    for key, lookup in (
        ('created_from', 'date_joined__date__gte'),
        ('created_to', 'date_joined__date__lte'),
        ('last_login_from', 'last_login__date__gte'),
        ('last_login_to', 'last_login__date__lte'),
    ):
        if params.get(key):
            queryset = queryset.filter(**{lookup: params[key]})
    ordering = params.get('ordering', '-date_joined')
    allowed = {
        'date_joined',
        '-date_joined',
        'last_login',
        '-last_login',
        'email',
        '-email',
        'full_name',
        '-full_name',
        'role',
        '-role',
        'status',
        '-status',
        'email_verified',
        '-email_verified',
        'last_session_seen_at',
        '-last_session_seen_at',
        'recruiter_profile__company__company_name',
        '-recruiter_profile__company__company_name',
        'recruiter_profile__company_role',
        '-recruiter_profile__company_role',
        'recruiter_initial_onboarding_completed',
        '-recruiter_initial_onboarding_completed',
        'recruiter_profile__verification_case__status',
        '-recruiter_profile__verification_case__status',
    }
    # Accept the old ordering key during the admin-client rollout, but never
    # read the legacy timestamp as a source of truth.
    if scope != ACCOUNT_SCOPE_USERS and ordering in {'next_action', '-next_action'}:
        # Most urgent first, then the longest-waiting submission.
        rank = F('recruiter_next_action_rank')
        return queryset.order_by(
            rank.desc() if ordering.startswith('-') else rank.asc(),
            F('recruiter_profile__verification_case__submitted_at').asc(nulls_last=True),
            '-id',
        )
    return queryset.order_by(ordering if ordering in allowed else '-date_joined', '-id')


def _status_summary(queryset):
    return queryset.aggregate(
        total=Count('id', distinct=True),
        active=Count('id', filter=Q(status=User.Status.ACTIVE), distinct=True),
        restricted=Count(
            'id',
            filter=Q(status__in=[User.Status.INACTIVE, User.Status.BANNED]),
            distinct=True,
        ),
        unverified=Count('id', filter=Q(email_verified=False), distinct=True),
    )


def account_summary(actor, *, scope=''):
    base = User.objects.filter(is_deleted=False).filter(_account_visibility(actor)).distinct()
    if scope == ACCOUNT_SCOPE_USERS:
        users = base.filter(role__in=[User.Role.CANDIDATE, User.Role.ADMIN])
        pending_invitations = (
            invitation_queryset(params={'status': AdminInvitation.Status.PENDING})
            .filter(expires_at__gt=timezone.now())
            .count()
            if actor.is_superuser
            else 0
        )
        return {
            'scope': ACCOUNT_SCOPE_USERS,
            'totals': _status_summary(users),
            'by_role': {
                User.Role.CANDIDATE: _status_summary(users.filter(role=User.Role.CANDIDATE)),
                User.Role.ADMIN: _status_summary(users.filter(role=User.Role.ADMIN)),
            },
            'queues': {
                'pending_admin_invitations': pending_invitations,
            },
        }
    if scope == ACCOUNT_SCOPE_RECRUITERS:
        recruiters = _with_recruiter_initial_onboarding(base.filter(role=User.Role.EMPLOYER))
        verification_base = EmployerVerificationCase.objects.filter(recruiter__user__in=recruiters)
        pending_states = [
            EmployerVerificationCase.Status.PENDING,
            EmployerVerificationCase.Status.IN_REVIEW,
        ]
        pending_verification_filter = Q(status__in=pending_states) | Q(
            documents__is_current=True,
            documents__status=CompanyDocument.Status.PENDING,
        )
        queue = _with_recruiter_next_action(recruiters).aggregate(
            admin_queue=Count(
                'id',
                filter=Q(recruiter_next_action__in=next_action.ADMIN_QUEUE_CODES),
                distinct=True,
            ),
            **{
                code: Count('id', filter=Q(recruiter_next_action=code), distinct=True)
                for code in (
                    next_action.VERIFICATION_OVERDUE,
                    next_action.AWAITING_RESUBMISSION,
                )
            },
        )
        return {
            'scope': ACCOUNT_SCOPE_RECRUITERS,
            'next_actions': queue,
            'totals': _status_summary(recruiters),
            'linked_company': recruiters.filter(recruiter_profile__company__isnull=False).count(),
            'companyless': recruiters.filter(
                Q(recruiter_profile__isnull=True) | Q(recruiter_profile__company__isnull=True)
            ).count(),
            'onboarding_incomplete': recruiters.filter(
                recruiter_initial_onboarding_completed=False
            ).count(),
            'verification': {
                'approved': verification_base.filter(
                    status=EmployerVerificationCase.Status.APPROVED
                ).count(),
                'pending': verification_base.filter(pending_verification_filter).distinct().count(),
                'overdue': verification_base.filter(
                    pending_verification_filter,
                    submitted_at__lt=timezone.now() - timedelta(hours=72),
                )
                .distinct()
                .count(),
                'changes_requested': verification_base.filter(
                    status=EmployerVerificationCase.Status.CHANGES_REQUESTED
                ).count(),
            },
        }

    summary = {
        **_status_summary(base),
        'pending_admin': base.filter(
            role=User.Role.ADMIN,
            status=User.Status.PENDING,
        ).count(),
    }
    verification_base = EmployerVerificationCase.objects.filter(recruiter__user__in=base)
    pending_states = [
        EmployerVerificationCase.Status.PENDING,
        EmployerVerificationCase.Status.IN_REVIEW,
    ]
    summary.update(
        employer_verification_pending=verification_base.filter(status__in=pending_states).count(),
        employer_verification_overdue=verification_base.filter(
            status__in=pending_states,
            submitted_at__lt=timezone.now() - timedelta(hours=72),
        ).count(),
        company_update_pending=CompanyUpdateRequest.objects.filter(
            requested_by__in=base,
            status=CompanyUpdateRequest.Status.PENDING,
        ).count(),
    )
    return summary


def account_sessions_queryset(user):
    return AuthSession.objects.filter(user=user).order_by('-last_seen_at')[:50]


def invitation_queryset(*, params=None):
    """Lời mời quản trị — view chỉ cho superuser gọi."""

    params = params or {}
    queryset = AdminInvitation.objects.select_related('user', 'invited_by')
    if params.get('status'):
        queryset = queryset.filter(status=params['status'])
    if params.get('invited_by'):
        queryset = queryset.filter(invited_by__public_id=params['invited_by'])
    query = params.get('q', '').strip()
    if query:
        queryset = queryset.filter(
            Q(user__email__icontains=query)
            | Q(user__full_name__icontains=query)
            | Q(invited_by__email__icontains=query)
            | Q(invited_by__full_name__icontains=query)
        )
    ordering = params.get('ordering', '-created_at')
    allowed = {
        'user__full_name',
        '-user__full_name',
        'invited_by__full_name',
        '-invited_by__full_name',
        'status',
        '-status',
        'expires_at',
        '-expires_at',
        'created_at',
        '-created_at',
    }
    return queryset.order_by(
        ordering if ordering in allowed else '-created_at',
        '-id',
    )

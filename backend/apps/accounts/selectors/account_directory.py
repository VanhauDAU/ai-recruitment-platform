"""Administrator account directory: list, summary, sessions, activity and invitations."""

from datetime import timedelta

from django.db.models import (
    BooleanField,
    Case,
    Count,
    Exists,
    Max,
    OuterRef,
    Prefetch,
    Q,
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
from common.api.params import parse_bool

from ..models import (
    AdminAccessAuditLog,
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


def _account_visibility(actor):
    """Superuser thấy mọi tài khoản; admin thường chỉ thấy ứng viên và NTD."""

    if actor.is_superuser:
        return Q()
    return Q(role__in=[User.Role.CANDIDATE, User.Role.EMPLOYER])


def accounts_queryset(actor, *, params=None):
    params = params or {}
    queryset = (
        _with_recruiter_initial_onboarding(
            User.objects.filter(is_deleted=False).filter(_account_visibility(actor))
        )
        .select_related(
            'candidate_profile',
            'candidate_profile__job_preference',
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
            'social_accounts',
            'candidate_profile__job_preference__desired_specializations__job_category',
            'candidate_profile__job_preference__preferred_provinces__location',
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
    scope = params.get('scope', '').strip()
    if scope == ACCOUNT_SCOPE_USERS:
        queryset = queryset.filter(role__in=[User.Role.CANDIDATE, User.Role.ADMIN])
    elif scope == ACCOUNT_SCOPE_RECRUITERS:
        queryset = queryset.filter(role=User.Role.EMPLOYER)

    query = params.get('q', '').strip()
    if query:
        queryset = queryset.filter(
            Q(email__icontains=query)
            | Q(full_name__icontains=query)
            | Q(public_id__icontains=query)
        )
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
    ordering = {
        'recruiter_profile__onboarding_completed_at': ('recruiter_initial_onboarding_completed'),
        '-recruiter_profile__onboarding_completed_at': ('-recruiter_initial_onboarding_completed'),
    }.get(ordering, ordering)
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
        return {
            'scope': ACCOUNT_SCOPE_RECRUITERS,
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


def account_activity_queryset(user):
    return AdminAccessAuditLog.objects.filter(
        Q(target_public_id=user.public_id) | Q(payload__user_public_id=user.public_id)
    ).select_related('actor')


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

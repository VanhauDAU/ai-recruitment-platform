"""Read models for administrator account management."""

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

from apps.accounts.domain.impact_token_rules import create_impact_token
from apps.applications.models import Application
from apps.campaigns.models import RecruitmentCampaign
from apps.employers.models import (
    CompanyDocument,
    CompanyUpdateRequest,
    EmployerVerificationCase,
    RecruitmentNeed,
)
from apps.jobs.models import Job
from common.api.params import parse_bool

from ..models import (
    AdminAccessAuditLog,
    AdminInvitation,
    AuthSession,
    User,
)
from .admin_audit import current_audit_revision

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


def _group_counts(queryset, *fields):
    return [
        {
            **{field: row[field] for field in fields},
            'count': row['count'],
        }
        for row in queryset.values(*fields).annotate(count=Count('id')).order_by(*fields)
    ]


def account_status_resource_snapshot(user):
    """Return a deterministic, role-aware snapshot bound into impact tokens."""
    snapshot = {
        'user': {
            'status': user.status,
            'is_active': bool(user.is_active),
            'is_deleted': bool(user.is_deleted),
            'auth_revision': user.auth_revision,
            'updated_at': user.updated_at.isoformat() if user.updated_at else None,
        },
        'active_session_count': AuthSession.objects.filter(
            user=user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).count(),
        'role': user.role,
    }
    if user.role == User.Role.EMPLOYER:
        campaigns = RecruitmentCampaign.objects.filter(owner__user=user)
        jobs = Job.objects.filter(posted_by=user)
        company_id = (
            user.recruiter_profile.company_id if hasattr(user, 'recruiter_profile') else None
        )
        snapshot['employer'] = {
            'campaigns': _group_counts(campaigns, 'status', 'policy_hold'),
            'jobs': _group_counts(jobs, 'status', 'policy_hold'),
            'open_application_count': Application.objects.filter(job__posted_by=user)
            .exclude(status__in=[Application.Status.REJECTED, Application.Status.ACCEPTED])
            .count(),
            'affected_candidate_count': Application.objects.filter(job__posted_by=user)
            .values('candidate_id')
            .distinct()
            .count(),
            'company_id': company_id,
            'other_active_recruiter_count': (
                User.objects.filter(
                    recruiter_profile__company_id=company_id,
                    role=User.Role.EMPLOYER,
                    status=User.Status.ACTIVE,
                    is_active=True,
                    is_deleted=False,
                )
                .exclude(pk=user.pk)
                .count()
                if company_id
                else 0
            ),
        }
    elif user.role == User.Role.CANDIDATE:
        applications = Application.objects.filter(candidate=user)
        snapshot['candidate'] = {
            'applications': _group_counts(applications, 'status'),
            'application_count': applications.count(),
            'cv_count': user.cvs.filter(is_deleted=False).count(),
        }
    return snapshot


def _allowed_account_status_transition(before, after):
    return after in {
        User.Status.ACTIVE: {User.Status.INACTIVE, User.Status.BANNED},
        User.Status.INACTIVE: {User.Status.ACTIVE, User.Status.BANNED},
        User.Status.BANNED: {User.Status.INACTIVE},
    }.get(before, set())


def _status_transition_kind(before, after):
    if after == User.Status.BANNED:
        return 'ban'
    if after == User.Status.INACTIVE and before == User.Status.BANNED:
        return 'begin_reactivation'
    if after == User.Status.INACTIVE:
        return 'suspend'
    return 'reactivate'


def _resource_review_required(snapshot):
    employer = snapshot.get('employer') or {}
    return any(
        row['policy_hold'] in {'ban_review', 'legacy_lock'} and row['count']
        for group in ('campaigns', 'jobs')
        for row in employer.get(group, [])
    )


def account_status_impact(
    user,
    *,
    status,
    reason,
    enforcement_evidence='',
    violation_category='',
):
    reason = reason.strip()
    enforcement_evidence = enforcement_evidence.strip()
    snapshot = account_status_resource_snapshot(user)
    transition_allowed = _allowed_account_status_transition(user.status, status)
    review_required = (
        user.role == User.Role.EMPLOYER
        and status == User.Status.ACTIVE
        and _resource_review_required(snapshot)
    )
    payload = {
        'status': status,
        'reason': reason,
        'enforcement_evidence': enforcement_evidence,
        'violation_category': violation_category,
        'snapshot': snapshot,
    }
    employer = snapshot.get('employer')
    candidate = snapshot.get('candidate')
    effects = {
        'sessions_will_be_revoked': status != User.Status.ACTIVE,
        'credentials_will_be_invalidated': status != User.Status.ACTIVE,
        'business_statuses_will_remain_unchanged': True,
        'company_other_recruiters_affected': False,
    }
    if employer:
        effects.update(
            campaigns=employer['campaigns'],
            jobs=employer['jobs'],
            open_application_count=employer['open_application_count'],
            affected_candidate_count=employer['affected_candidate_count'],
            resource_hold=(
                'ban_review'
                if status == User.Status.BANNED
                else 'temporary_lock'
                if status == User.Status.INACTIVE and user.status != User.Status.BANNED
                else 'clear_temporary_lock'
                if status == User.Status.ACTIVE
                else 'unchanged'
            ),
        )
    if candidate:
        effects.update(
            applications=candidate['applications'],
            cv_count=candidate['cv_count'],
            candidate_data_will_be_retained=True,
            employer_pipeline_updates_limited_to_rejected=status != User.Status.ACTIVE,
        )
    active_sessions = AuthSession.objects.filter(
        user=user,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).count()
    return {
        'operation': 'account.status.change',
        'target': {
            'public_id': user.public_id,
            'email': user.email,
            'full_name': user.full_name,
            'role': user.role,
        },
        'before': {'status': user.status},
        'after': {'status': status},
        'transition_kind': _status_transition_kind(user.status, status),
        'active_session_count': active_sessions,
        'sessions_will_be_revoked': status != User.Status.ACTIVE,
        'effects': effects,
        'requires_manual_resource_review': review_required,
        'restoration_policy': (
            'Chuyển tài khoản cấm sang tạm khóa, rà soát và gỡ giữ tài nguyên, sau đó mới mở lại.'
            if user.status == User.Status.BANNED
            else 'Policy hold tạm thời được gỡ khi mở lại; trạng thái nghiệp vụ gốc được giữ nguyên.'
        ),
        'blocked_reasons': (
            ['Cần gỡ giữ tài nguyên bị cấm/khóa cũ trước khi mở lại.'] if review_required else []
        ),
        'can_apply': transition_allowed and not review_required,
        'impact_token': create_impact_token(
            revision=current_audit_revision(),
            operation='account.status.change',
            resource_key=f'account:{user.public_id}',
            normalized_payload=payload,
        ),
    }


def account_resource_hold_impact(
    user,
    *,
    reason,
    enforcement_evidence,
):
    snapshot = account_status_resource_snapshot(user)
    employer = snapshot.get('employer') or {}
    releasable = {'ban_review', 'legacy_lock'}
    campaign_count = sum(
        row['count'] for row in employer.get('campaigns', []) if row['policy_hold'] in releasable
    )
    job_count = sum(
        row['count'] for row in employer.get('jobs', []) if row['policy_hold'] in releasable
    )
    payload = {
        'reason': reason.strip(),
        'enforcement_evidence': enforcement_evidence.strip(),
        'snapshot': snapshot,
    }
    return {
        'operation': 'account.resource_hold.release',
        'target': {
            'public_id': user.public_id,
            'email': user.email,
            'full_name': user.full_name,
            'role': user.role,
        },
        'campaign_count': campaign_count,
        'job_count': job_count,
        'business_statuses_will_remain_unchanged': True,
        'account_will_remain_inactive': True,
        'can_apply': bool(
            user.role == User.Role.EMPLOYER
            and user.status == User.Status.INACTIVE
            and (campaign_count or job_count)
        ),
        'impact_token': create_impact_token(
            revision=current_audit_revision(),
            operation='account.resource_hold.release',
            resource_key=f'account:{user.public_id}',
            normalized_payload=payload,
        ),
    }


def account_revoke_sessions_impact(user, *, reason):
    sessions = list(
        AuthSession.objects.filter(
            user=user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).order_by('-last_seen_at')
    )
    payload = {'reason': reason.strip()}
    return {
        'operation': 'account.sessions.revoke',
        'target': {
            'public_id': user.public_id,
            'email': user.email,
            'full_name': user.full_name,
            'role': user.role,
        },
        'active_session_count': len(sessions),
        'sessions': [
            {
                'id': str(session.id),
                'device_label': session.device_label,
                'last_seen_at': session.last_seen_at,
            }
            for session in sessions[:20]
        ],
        'has_more': len(sessions) > 20,
        'can_apply': bool(sessions),
        'impact_token': create_impact_token(
            revision=current_audit_revision(),
            operation='account.sessions.revoke',
            resource_key=f'account:{user.public_id}',
            normalized_payload=payload,
        ),
    }


def _active_recovery_session_count(user):
    return AuthSession.objects.filter(
        user=user,
        auth_revision=user.auth_revision,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).count()


def _account_email_snapshot(user):
    providers = sorted({item.provider for item in user.social_accounts.all()})
    return {
        'email': User.objects.normalize_email(user.email),
        'email_verified': bool(user.email_verified),
        'has_usable_password': user.has_usable_password(),
        'auth_revision': user.auth_revision,
        'oauth_providers': providers,
    }


def account_email_change_impact(user, *, email, reason, verification_evidence):
    email = User.objects.normalize_email(email)
    before = _account_email_snapshot(user)
    payload = {
        'email': email,
        'reason': reason.strip(),
        'verification_evidence': verification_evidence.strip(),
        'before': before,
    }
    return {
        'operation': 'account.email.change',
        'target': {
            'public_id': user.public_id,
            'email': user.email,
            'full_name': user.full_name,
            'role': user.role,
            'status': user.status,
        },
        'before': {
            'email': before['email'],
            'email_verified': before['email_verified'],
            'has_usable_password': before['has_usable_password'],
        },
        'after': {
            'email': email,
            'email_verified': False,
            'has_usable_password': False,
        },
        'active_session_count': _active_recovery_session_count(user),
        'oauth_providers_to_revoke': before['oauth_providers'],
        'password_reset_required': True,
        'password_reset_available': user.status == User.Status.ACTIVE and user.is_active,
        'email_verification_required': True,
        'can_apply': before['email'] != email,
        'impact_token': create_impact_token(
            revision=current_audit_revision(),
            operation='account.email.change',
            resource_key=f'account:{user.public_id}',
            normalized_payload=payload,
        ),
    }

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

from apps.applications.models import Application
from apps.employers.models import (
    CompanyDocument,
    CompanyUpdateRequest,
    EmployerVerificationCase,
    RecruitmentCampaign,
    RecruitmentNeed,
)
from apps.jobs.models import Job

from ..admin_access_rules import create_impact_token
from ..models import (
    AdminAccessAuditLog,
    AdminInvitation,
    AdminMembership,
    AdminProvisioningScope,
    AdminRole,
    AuthSession,
    User,
)
from .admin_access import current_rbac_revision, effective_permission_codes

SENSITIVE_PROVISIONING_CODES = frozenset(
    {
        'account.admin.invite',
        'account.admin.manage',
        'admin_access.manage_role',
        'admin_access.manage_staff',
    }
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
    if actor.is_superuser:
        return Q()
    permissions = effective_permission_codes(actor)
    visible = Q(pk__in=[])
    if 'account.view' in permissions:
        visible |= Q(role__in=[User.Role.CANDIDATE, User.Role.EMPLOYER])
    if 'account.employer.view' in permissions:
        visible |= Q(role=User.Role.EMPLOYER)
    if 'employer_verification.view' in permissions:
        visible |= Q(role=User.Role.EMPLOYER)
    if 'company_update.view' in permissions:
        visible |= Q(role=User.Role.EMPLOYER)
    if 'account.admin.view' in permissions:
        visible |= Q(role=User.Role.ADMIN)
    if 'account.admin.invite' in permissions:
        visible |= Q(role=User.Role.ADMIN, admin_invitations_received__invited_by=actor)
    return visible


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
                'admin_memberships',
                queryset=AdminMembership.objects.filter(is_active=True)
                .select_related('role__department', 'assigned_by')
                .prefetch_related('role__permissions'),
                to_attr='active_admin_memberships',
            ),
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
    for key, field in (
        ('email_verified', 'email_verified'),
        ('mfa', 'two_factor_enabled'),
    ):
        value = params.get(key, '').lower()
        if value in {'true', 'false'}:
            queryset = queryset.filter(**{field: value == 'true'})
    session_filter = params.get('has_active_session', '').lower()
    if session_filter in {'true', 'false'}:
        queryset = queryset.filter(
            **(
                {'active_session_count__gt': 0}
                if session_filter == 'true'
                else {'active_session_count': 0}
            )
        )
    if params.get('department'):
        queryset = queryset.filter(
            admin_memberships__is_active=True,
            admin_memberships__role__department__public_id=params['department'],
        )
    if params.get('admin_role'):
        queryset = queryset.filter(
            admin_memberships__is_active=True,
            admin_memberships__role__public_id=params['admin_role'],
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
        'two_factor_enabled',
        '-two_factor_enabled',
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
        pending_invitations = invitation_queryset(
            actor,
            params={'status': AdminInvitation.Status.PENDING},
        ).filter(expires_at__gt=timezone.now())
        return {
            'scope': ACCOUNT_SCOPE_USERS,
            'totals': _status_summary(users),
            'by_role': {
                User.Role.CANDIDATE: _status_summary(users.filter(role=User.Role.CANDIDATE)),
                User.Role.ADMIN: _status_summary(users.filter(role=User.Role.ADMIN)),
            },
            'queues': {
                'pending_admin_invitations': pending_invitations.count(),
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


def invitation_queryset(actor, *, params=None):
    params = params or {}
    queryset = AdminInvitation.objects.select_related(
        'user',
        'target_role__department',
        'provisioning_scope__source_role',
        'invited_by',
    ).prefetch_related('target_role__permissions')
    if not actor.is_superuser:
        if 'account.admin.invite' not in effective_permission_codes(actor):
            return queryset.none()
        queryset = queryset.filter(invited_by=actor)
    if params.get('status'):
        queryset = queryset.filter(status=params['status'])
    if params.get('department'):
        queryset = queryset.filter(target_role__department__public_id=params['department'])
    if params.get('role'):
        queryset = queryset.filter(target_role__public_id=params['role'])
    if actor.is_superuser and params.get('invited_by'):
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
        'target_role__name',
        '-target_role__name',
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


def available_invitation_roles(actor):
    queryset = (
        AdminRole.objects.filter(is_active=True, department__is_active=True)
        .select_related('department')
        .prefetch_related('permissions')
    )
    if actor.is_superuser:
        return queryset.order_by('department__name', '-rank', 'name')
    membership = (
        AdminMembership.objects.filter(
            user=actor,
            is_active=True,
            role__is_active=True,
            role__department__is_active=True,
        )
        .select_related('role')
        .first()
    )
    if membership is None or 'account.admin.invite' not in effective_permission_codes(actor):
        return queryset.none()
    return (
        queryset.filter(
            provisioned_by_scopes__source_role=membership.role,
            provisioned_by_scopes__is_active=True,
        )
        .exclude(permissions__code__in=SENSITIVE_PROVISIONING_CODES)
        .distinct()
        .order_by('department__name', '-rank', 'name')
    )


def provisioning_scopes_queryset():
    return (
        AdminProvisioningScope.objects.select_related(
            'source_role__department',
            'target_role__department',
            'configured_by',
        )
        .prefetch_related('source_role__permissions', 'target_role__permissions')
        .annotate(
            pending_invitation_count=Count(
                'admin_invitations',
                filter=Q(admin_invitations__status=AdminInvitation.Status.PENDING),
            )
        )
    )


def provisioning_scope_status_impact(scope, *, is_active):
    pending_qs = AdminInvitation.objects.filter(
        provisioning_scope=scope,
        status=AdminInvitation.Status.PENDING,
    ).select_related('user')
    count = pending_qs.count() if not is_active else 0
    pending = list(pending_qs.order_by('created_at', 'id')[:20])
    payload = {'is_active': bool(is_active)}
    return {
        'operation': 'provisioning_scope.status.change',
        'target': {
            'public_id': scope.public_id,
            'source_role': scope.source_role.name,
            'target_role': scope.target_role.name,
        },
        'is_active': bool(is_active),
        'pending_invitation_count': count,
        'affected_accounts': [
            {
                'public_id': invitation.user.public_id,
                'email': invitation.user.email,
                'full_name': invitation.user.full_name,
            }
            for invitation in pending
        ],
        'has_more': count > len(pending),
        'can_apply': scope.is_active != bool(is_active),
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='provisioning_scope.status.change',
            resource_key=f'provisioning-scope:{scope.public_id}',
            normalized_payload=payload,
        ),
    }


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
            revision=current_rbac_revision(),
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
            revision=current_rbac_revision(),
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
            revision=current_rbac_revision(),
            operation='account.sessions.revoke',
            resource_key=f'account:{user.public_id}',
            normalized_payload=payload,
        ),
    }


def _account_mfa_snapshot(user):
    has_totp = bool(user.two_factor_totp_secret)
    has_email = bool(user.two_factor_email_enabled or (user.two_factor_enabled and not has_totp))
    return {
        'email': has_email,
        'totp': has_totp,
        'backup_codes_remaining': len(user.two_factor_backup_code_hashes or []),
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
        'mfa_methods': _account_mfa_snapshot(user),
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
        'mfa_methods': before['mfa_methods'],
        'password_reset_required': True,
        'password_reset_available': user.status == User.Status.ACTIVE and user.is_active,
        'email_verification_required': True,
        'can_apply': before['email'] != email,
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='account.email.change',
            resource_key=f'account:{user.public_id}',
            normalized_payload=payload,
        ),
    }


def account_mfa_reset_impact(user, *, reason, verification_evidence):
    methods = _account_mfa_snapshot(user)
    payload = {
        'reason': reason.strip(),
        'verification_evidence': verification_evidence.strip(),
        'auth_revision': user.auth_revision,
        'methods': methods,
    }
    return {
        'operation': 'account.mfa.reset',
        'target': {
            'public_id': user.public_id,
            'email': user.email,
            'full_name': user.full_name,
            'role': user.role,
            'status': user.status,
        },
        'methods_to_disable': methods,
        'active_session_count': _active_recovery_session_count(user),
        'password_will_remain_unchanged': True,
        'can_apply': bool(methods['email'] or methods['totp'] or methods['backup_codes_remaining']),
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='account.mfa.reset',
            resource_key=f'account:{user.public_id}',
            normalized_payload=payload,
        ),
    }

"""Read models for administrator account management."""

from datetime import timedelta

from django.db.models import Count, Max, Prefetch, Q
from django.utils import timezone

from apps.employers.models import (
    CompanyDocument,
    EmployerVerificationCase,
    RecruitmentNeed,
)

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


def _account_visibility(actor):
    if actor.is_superuser:
        return Q()
    permissions = effective_permission_codes(actor)
    visible = Q(pk__in=[])
    if 'account.view' in permissions:
        visible |= Q(role__in=[User.Role.CANDIDATE, User.Role.EMPLOYER])
    if 'employer_verification.view' in permissions:
        visible |= Q(role=User.Role.EMPLOYER)
    if 'account.admin.view' in permissions:
        visible |= Q(role=User.Role.ADMIN)
    if 'account.admin.invite' in permissions:
        visible |= Q(role=User.Role.ADMIN, admin_invitations_received__invited_by=actor)
    return visible


def accounts_queryset(actor, *, params=None):
    params = params or {}
    queryset = (
        User.objects.filter(is_deleted=False)
        .filter(_account_visibility(actor))
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
    query = params.get('q', '').strip()
    if query:
        queryset = queryset.filter(
            Q(email__icontains=query)
            | Q(full_name__icontains=query)
            | Q(public_id__icontains=query)
        )
    for field in ('role', 'status'):
        if params.get(field):
            queryset = queryset.filter(**{field: params[field]})
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
    }
    return queryset.order_by(ordering if ordering in allowed else '-date_joined', '-id')


def account_summary(actor):
    base = User.objects.filter(is_deleted=False).filter(_account_visibility(actor)).distinct()
    summary = base.aggregate(
        total=Count('id', distinct=True),
        active=Count('id', filter=Q(status=User.Status.ACTIVE), distinct=True),
        restricted=Count(
            'id',
            filter=Q(status__in=[User.Status.INACTIVE, User.Status.BANNED]),
            distinct=True,
        ),
        unverified=Count('id', filter=Q(email_verified=False), distinct=True),
        pending_admin=Count(
            'id',
            filter=Q(role=User.Role.ADMIN, status=User.Status.PENDING),
            distinct=True,
        ),
    )
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
    return queryset.order_by('-created_at', '-id')


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


def account_status_impact(user, *, status, reason):
    active_sessions = AuthSession.objects.filter(
        user=user,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).count()
    payload = {'status': status, 'reason': reason.strip()}
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
        'active_session_count': active_sessions,
        'sessions_will_be_revoked': status != User.Status.ACTIVE,
        'can_apply': user.status != status,
        'impact_token': create_impact_token(
            revision=current_rbac_revision(),
            operation='account.status.change',
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

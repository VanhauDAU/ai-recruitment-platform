"""Impact previews for destructive account actions.

Each preview returns what the action would change plus an impact token bound to
that snapshot; the matching service refuses to run if the snapshot moved since.
"""

from django.utils import timezone
from django.utils.translation import gettext as _

from apps.accounts.domain.impact_token_rules import create_impact_token

from ..models import (
    AuthSession,
    User,
    account_status_resource_snapshot,
)
from .admin_audit import current_audit_revision


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
            _(
                'Chuyển tài khoản cấm sang tạm khóa, rà soát và gỡ giữ tài nguyên, sau đó mới mở lại.'
            )
            if user.status == User.Status.BANNED
            else _(
                'Policy hold tạm thời được gỡ khi mở lại; trạng thái nghiệp vụ gốc được giữ nguyên.'
            )
        ),
        'blocked_reasons': (
            [_('Cần gỡ giữ tài nguyên bị cấm/khóa cũ trước khi mở lại.')] if review_required else []
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

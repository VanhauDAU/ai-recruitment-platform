"""Transactional administrator account-management use cases."""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, Max
from django.utils import timezone

from apps.applications.models import Application
from apps.candidates.models import CandidateProfile
from apps.employers.models import CampaignActivity, RecruiterProfile, RecruitmentCampaign
from apps.jobs.models import Job
from apps.locations.models import Location

from ..admin_access_cache import bust_admin_permission_cache
from ..admin_access_rules import StaleImpactToken, decode_impact_token
from ..admin_invitation_tokens import (
    InvalidAdminInvitationToken,
    decode_admin_invitation_token,
)
from ..exceptions import AdminPermissionDenied
from ..models import (
    AccountStatusTransition,
    AdminAccessAuditLog,
    AdminInvitation,
    AdminMembership,
    AdminProvisioningScope,
    AdminRole,
    AuthEmailJob,
    AuthSession,
    User,
)
from . import auth_sessions, password_reset, two_factor
from .admin_access import assign_membership, record_admin_action
from .tokens import revoke_refresh_tokens

INVITATION_TTL = timedelta(hours=72)
SENSITIVE_PROVISIONING_CODES = frozenset(
    {
        'account.admin.invite',
        'account.admin.manage',
        'admin_access.manage_role',
        'admin_access.manage_staff',
    }
)


def _actor_kwargs(actor):
    return {'actor': actor, 'source': 'api', 'actor_identifier': actor.email}


def _has_permission(actor, code):
    if actor.is_superuser:
        return True
    return AdminMembership.objects.filter(
        user=actor,
        is_active=True,
        role__is_active=True,
        role__department__is_active=True,
        role__permissions__code=code,
        role__permissions__is_active=True,
    ).exists()


def _active_membership(actor, *, lock=False):
    queryset = AdminMembership.objects.filter(
        user=actor,
        is_active=True,
        role__is_active=True,
        role__department__is_active=True,
    ).select_related('role__department')
    if lock:
        queryset = queryset.select_for_update()
    return queryset.first()


def _queue_invitation_email(invitation):
    from ..tasks import queue_auth_email

    return queue_auth_email(
        AuthEmailJob.Kind.ADMIN_INVITATION,
        invitation.user,
        context={
            'invitation_public_id': invitation.public_id,
            'token_version': invitation.token_version,
        },
    )


def _ensure_reason(reason):
    cleaned = (reason or '').strip()
    if not cleaned:
        raise ValidationError({'reason': 'Vui lòng nhập lý do thao tác.'})
    if len(cleaned) > 500:
        raise ValidationError({'reason': 'Lý do không được vượt quá 500 ký tự.'})
    return cleaned


def _ensure_verification_evidence(verification_evidence):
    cleaned = (verification_evidence or '').strip()
    if len(cleaned) < 20:
        raise ValidationError(
            {
                'verification_evidence': (
                    'Bằng chứng xác minh cần mô tả cụ thể và có ít nhất 20 ký tự.'
                )
            }
        )
    if len(cleaned) > 500:
        raise ValidationError(
            {'verification_evidence': 'Bằng chứng xác minh không được vượt quá 500 ký tự.'}
        )
    return cleaned


def _target_is_sensitive(role):
    return role.permissions.filter(
        is_active=True,
        code__in=SENSITIVE_PROVISIONING_CODES,
    ).exists()


def _resolve_invitation_scope(actor, target_role, *, lock=False):
    if actor.is_superuser:
        return None
    if not _has_permission(actor, 'account.admin.invite'):
        raise AdminPermissionDenied('Bạn không có quyền mời tài khoản quản trị.')
    membership = _active_membership(actor, lock=lock)
    if membership is None:
        raise ValidationError('Tài khoản chưa có chức danh cấp phát hiệu lực.')
    scopes = AdminProvisioningScope.objects.filter(
        source_role=membership.role,
        target_role=target_role,
        is_active=True,
    )
    if lock:
        scopes = scopes.select_for_update()
    scope = scopes.first()
    if scope is None:
        raise AdminPermissionDenied('Chức danh nằm ngoài phạm vi được cấp.')
    if _target_is_sensitive(target_role):
        raise AdminPermissionDenied('Chức danh nhạy cảm chỉ superuser được phép cấp.')
    return scope


def create_provisioning_scope(*, source_role, target_role, actor):
    if not actor.is_superuser:
        raise ValidationError('Chỉ superuser được cấu hình phạm vi cấp tài khoản.')
    if source_role.pk == target_role.pk or _target_is_sensitive(target_role):
        raise ValidationError(
            {'target_role': 'Không thể uỷ quyền cấp chức danh có quyền quản trị đặc quyền.'}
        )
    with transaction.atomic():
        source_role = AdminRole.objects.select_for_update().get(pk=source_role.pk)
        target_role = AdminRole.objects.select_for_update().get(pk=target_role.pk)
        if (
            not source_role.is_active
            or not source_role.department.is_active
            or not source_role.permissions.filter(
                code='account.admin.invite',
                is_active=True,
            ).exists()
        ):
            raise ValidationError(
                {'source_role': 'Chức danh nguồn chưa có quyền cấp tài khoản hiệu lực.'}
            )
        try:
            scope, created = AdminProvisioningScope.objects.get_or_create(
                source_role=source_role,
                target_role=target_role,
                defaults={'configured_by': actor},
            )
        except IntegrityError as error:
            raise ValidationError('Phạm vi cấp tài khoản đã tồn tại.') from error
        reactivated = not created and not scope.is_active
        if reactivated:
            scope.is_active = True
            scope.configured_by = actor
            scope.save(update_fields=['is_active', 'configured_by', 'updated_at'])
        if created or reactivated:
            record_admin_action(
                **_actor_kwargs(actor),
                action='create_provisioning_scope',
                target_type='provisioning_scope',
                target_public_id=scope.public_id,
                payload={
                    'source_role_public_id': source_role.public_id,
                    'target_role_public_id': target_role.public_id,
                },
            )
        return scope


def _current_revision():
    return AdminAccessAuditLog.objects.aggregate(value=Max('id'))['value'] or 0


def confirm_provisioning_scope_status(
    scope,
    *,
    is_active,
    impact_token,
    actor,
):
    if not actor.is_superuser:
        raise ValidationError('Chỉ superuser được cấu hình phạm vi cấp tài khoản.')
    claims = decode_impact_token(
        impact_token,
        operation='provisioning_scope.status.change',
        resource_key=f'provisioning-scope:{scope.public_id}',
        normalized_payload={'is_active': bool(is_active)},
    )
    with transaction.atomic():
        scope = AdminProvisioningScope.objects.select_for_update().get(pk=scope.pk)
        invitations = list(
            AdminInvitation.objects.select_for_update().filter(
                provisioning_scope=scope,
                status=AdminInvitation.Status.PENDING,
            )
        )
        if _current_revision() != claims['revision']:
            raise StaleImpactToken('Dữ liệu phân quyền đã thay đổi.')
        if scope.is_active == bool(is_active):
            return scope
        scope.is_active = bool(is_active)
        scope.configured_by = actor
        scope.save(update_fields=['is_active', 'configured_by', 'updated_at'])
        revoked_ids = []
        if not is_active:
            now = timezone.now()
            for invitation in invitations:
                invitation.status = AdminInvitation.Status.REVOKED
                invitation.revoked_at = now
                invitation.token_version += 1
                invitation.save(
                    update_fields=['status', 'revoked_at', 'token_version', 'updated_at']
                )
                revoked_ids.append(invitation.public_id)
        record_admin_action(
            **_actor_kwargs(actor),
            action='set_provisioning_scope_active',
            target_type='provisioning_scope',
            target_public_id=scope.public_id,
            payload={
                'is_active': bool(is_active),
                'revoked_invitation_public_ids': revoked_ids,
            },
        )
        return scope


def create_admin_invitation(*, email, full_name, target_role, reason, actor):
    reason = _ensure_reason(reason)
    normalized_email = User.objects.normalize_email(email)
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        target_role = (
            AdminRole.objects.select_for_update()
            .select_related('department')
            .get(pk=target_role.pk)
        )
        if not target_role.is_active or not target_role.department.is_active:
            raise ValidationError({'target_role': 'Chức danh hoặc phòng ban đang bị khoá.'})
        if not target_role.permissions.filter(is_active=True).exists():
            raise ValidationError({'target_role': 'Chức danh chưa có quyền hiệu lực.'})
        scope = _resolve_invitation_scope(actor, target_role, lock=True)
        existing = (
            User.objects.select_for_update()
            .filter(email__iexact=normalized_email, role=User.Role.ADMIN)
            .first()
        )
        if existing and (
            existing.status == User.Status.ACTIVE
            or AdminMembership.objects.filter(user=existing, is_active=True).exists()
        ):
            raise ValidationError({'email': 'Email đã có tài khoản quản trị hoạt động.'})
        if existing is None:
            user = User(
                email=normalized_email,
                full_name=full_name.strip(),
                role=User.Role.ADMIN,
                status=User.Status.PENDING,
                is_active=False,
                is_staff=False,
                is_superuser=False,
            )
            user.set_unusable_password()
            user.save()
        else:
            user = existing
            if AdminInvitation.objects.filter(
                user=user,
                status=AdminInvitation.Status.PENDING,
            ).exists():
                raise ValidationError({'email': 'Tài khoản đã có lời mời đang chờ xử lý.'})
            user.full_name = full_name.strip()
            user.status = User.Status.PENDING
            user.is_active = False
            user.is_staff = False
            user.is_superuser = False
            user.save(
                update_fields=[
                    'full_name',
                    'status',
                    'is_active',
                    'is_staff',
                    'is_superuser',
                    'updated_at',
                ]
            )
        invitation = AdminInvitation.objects.create(
            user=user,
            target_role=target_role,
            provisioning_scope=scope,
            invited_by=actor,
            reason=reason,
            expires_at=timezone.now() + INVITATION_TTL,
        )
        record_admin_action(
            **_actor_kwargs(actor),
            action='create_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={
                'user_public_id': user.public_id,
                'target_role_public_id': target_role.public_id,
                'source_role_public_id': (
                    scope.source_role.public_id if scope is not None else None
                ),
                'reason': reason,
            },
        )
        _queue_invitation_email(invitation)
        return invitation


def _lock_owned_invitation(invitation, actor):
    invitation = (
        AdminInvitation.objects.select_for_update(of=('self',))
        .select_related('user', 'target_role__department', 'provisioning_scope')
        .get(pk=invitation.pk)
    )
    if not actor.is_superuser and invitation.invited_by_id != actor.pk:
        raise AdminPermissionDenied('Bạn chỉ được quản lý lời mời do chính mình tạo.')
    return invitation


def update_admin_invitation_role(invitation, *, target_role, reason, actor):
    reason = _ensure_reason(reason)
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        invitation = _lock_owned_invitation(invitation, actor)
        if invitation.status != AdminInvitation.Status.PENDING:
            raise ValidationError('Chỉ lời mời đang chờ mới được thay đổi.')
        target_role = (
            AdminRole.objects.select_for_update()
            .select_related('department')
            .get(pk=target_role.pk)
        )
        scope = _resolve_invitation_scope(actor, target_role, lock=True)
        before = invitation.target_role.public_id
        invitation.target_role = target_role
        invitation.provisioning_scope = scope
        invitation.reason = reason
        invitation.token_version += 1
        invitation.expires_at = timezone.now() + INVITATION_TTL
        invitation.save(
            update_fields=[
                'target_role',
                'provisioning_scope',
                'reason',
                'token_version',
                'expires_at',
                'updated_at',
            ]
        )
        record_admin_action(
            **_actor_kwargs(actor),
            action='update_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={
                'user_public_id': invitation.user.public_id,
                'before_target_role_public_id': before,
                'target_role_public_id': target_role.public_id,
                'reason': reason,
            },
        )
        _queue_invitation_email(invitation)
        return invitation


def resend_admin_invitation(invitation, *, actor):
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        invitation = _lock_owned_invitation(invitation, actor)
        if invitation.status not in {
            AdminInvitation.Status.PENDING,
            AdminInvitation.Status.EXPIRED,
        }:
            raise ValidationError('Lời mời không còn có thể gửi lại.')
        _resolve_invitation_scope(actor, invitation.target_role, lock=True)
        invitation.status = AdminInvitation.Status.PENDING
        invitation.revoked_at = None
        invitation.token_version += 1
        invitation.expires_at = timezone.now() + INVITATION_TTL
        invitation.save(
            update_fields=[
                'status',
                'revoked_at',
                'token_version',
                'expires_at',
                'updated_at',
            ]
        )
        record_admin_action(
            **_actor_kwargs(actor),
            action='resend_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={'user_public_id': invitation.user.public_id},
        )
        _queue_invitation_email(invitation)
        return invitation


def revoke_admin_invitation(invitation, *, reason, actor):
    reason = _ensure_reason(reason)
    with transaction.atomic():
        actor = User.objects.select_for_update().get(pk=actor.pk)
        invitation = _lock_owned_invitation(invitation, actor)
        if invitation.status != AdminInvitation.Status.PENDING:
            raise ValidationError('Chỉ lời mời đang chờ mới được thu hồi.')
        invitation.status = AdminInvitation.Status.REVOKED
        invitation.reason = reason
        invitation.revoked_at = timezone.now()
        invitation.token_version += 1
        invitation.save(
            update_fields=[
                'status',
                'reason',
                'revoked_at',
                'token_version',
                'updated_at',
            ]
        )
        record_admin_action(
            **_actor_kwargs(actor),
            action='revoke_admin_invitation',
            target_type='admin_invitation',
            target_public_id=invitation.public_id,
            payload={'user_public_id': invitation.user.public_id, 'reason': reason},
        )
        return invitation


def resolve_admin_invitation(token):
    claims = decode_admin_invitation_token(token)
    invitation = (
        AdminInvitation.objects.select_related('user', 'target_role__department')
        .prefetch_related('target_role__permissions')
        .filter(public_id=claims['invitation'])
        .first()
    )
    if invitation is None or invitation.token_version != claims['version']:
        raise InvalidAdminInvitationToken('Liên kết mời không còn hiệu lực.')
    if invitation.status != AdminInvitation.Status.PENDING:
        raise InvalidAdminInvitationToken('Lời mời đã được sử dụng hoặc thu hồi.')
    if invitation.expires_at <= timezone.now():
        raise InvalidAdminInvitationToken('Liên kết mời đã hết hạn.')
    return invitation


def accept_admin_invitation(*, token, password):
    claims = decode_admin_invitation_token(token)
    with transaction.atomic():
        invitation = (
            AdminInvitation.objects.select_for_update(of=('self',))
            .select_related(
                'user',
                'target_role__department',
                'provisioning_scope',
                'invited_by',
            )
            .filter(public_id=claims['invitation'])
            .first()
        )
        if invitation is None or invitation.token_version != claims['version']:
            raise InvalidAdminInvitationToken('Liên kết mời không còn hiệu lực.')
        if invitation.status != AdminInvitation.Status.PENDING:
            raise InvalidAdminInvitationToken('Lời mời đã được sử dụng hoặc thu hồi.')
        if invitation.expires_at <= timezone.now():
            invitation.status = AdminInvitation.Status.EXPIRED
            invitation.save(update_fields=['status', 'updated_at'])
            raise InvalidAdminInvitationToken('Liên kết mời đã hết hạn.')
        if invitation.provisioning_scope_id:
            scope = AdminProvisioningScope.objects.select_for_update().get(
                pk=invitation.provisioning_scope_id
            )
            if not scope.is_active:
                raise InvalidAdminInvitationToken('Phạm vi cấp tài khoản đã bị thu hồi.')
        role = (
            AdminRole.objects.select_for_update()
            .select_related('department')
            .get(pk=invitation.target_role_id)
        )
        if (
            not role.is_active
            or not role.department.is_active
            or not role.permissions.filter(is_active=True).exists()
        ):
            raise ValidationError('Chức danh được mời không còn hiệu lực.')
        user = User.objects.select_for_update().get(pk=invitation.user_id)
        if user.status != User.Status.PENDING:
            raise InvalidAdminInvitationToken('Tài khoản không còn ở trạng thái chờ.')
        user.set_password(password)
        user.email_verified = True
        user.status = User.Status.ACTIVE
        user.is_active = True
        user.save(
            update_fields=[
                'password',
                'email_verified',
                'status',
                'is_active',
                'updated_at',
            ]
        )
        membership = assign_membership(
            user,
            role,
            actor=invitation.invited_by,
            source='invitation',
            actor_identifier=invitation.invited_by.email,
        )
        invitation.status = AdminInvitation.Status.ACCEPTED
        invitation.accepted_at = timezone.now()
        invitation.token_version += 1
        invitation.save(update_fields=['status', 'accepted_at', 'token_version', 'updated_at'])
        record_admin_action(
            actor=user,
            source='invitation',
            actor_identifier=user.email,
            action='accept_admin_invitation',
            target_type='user',
            target_public_id=user.public_id,
            payload={
                'user_public_id': user.public_id,
                'membership_public_id': membership.public_id,
                'target_role_public_id': role.public_id,
            },
        )
        return user


def ensure_account_write_allowed(actor, user, permission):
    if user.is_admin_role:
        if not actor.is_superuser:
            raise AdminPermissionDenied('Chỉ superuser được thay đổi tài khoản quản trị.')
        return
    if not _has_permission(actor, permission):
        raise AdminPermissionDenied()


def update_account_profile(user, *, full_name, phone, actor):
    ensure_account_write_allowed(actor, user, 'account.profile.manage')
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        changed = []
        for field, value in (('full_name', full_name.strip()), ('phone', phone.strip())):
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed.append(field)
        if changed:
            user.save(update_fields=[*changed, 'updated_at'])
            record_admin_action(
                **_actor_kwargs(actor),
                action='update_account_profile',
                target_type='user',
                target_public_id=user.public_id,
                payload={'user_public_id': user.public_id, 'changed_fields': changed},
            )
        return user


def update_managed_account_profile(user, *, actor, changes):
    """Update only administrator-safe profile fields for the target role."""
    ensure_account_write_allowed(actor, user, 'account.profile.manage')
    account_fields = {'full_name', 'phone'}
    candidate_fields = {
        'date_of_birth',
        'gender',
        'address',
        'headline',
        'bio',
        'career_objective',
        'current_position',
        'desired_position',
        'experience_years',
        'education_level',
        'expected_salary_min',
        'expected_salary_max',
        'preferred_location',
        'preferred_work_type',
        'job_search_status',
        'portfolio_url',
        'github_url',
        'linkedin_url',
    }
    employer_fields = {'gender', 'position_title', 'contact_phone'}

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        changed_fields = []
        user_updates = []
        for field in account_fields & changes.keys():
            value = changes[field].strip() if isinstance(changes[field], str) else changes[field]
            if getattr(user, field) != value:
                setattr(user, field, value)
                user_updates.append(field)
                changed_fields.append(f'account.{field}')
        if user_updates:
            user.save(update_fields=[*user_updates, 'updated_at'])

        if user.is_candidate:
            profile, _ = CandidateProfile.objects.select_for_update().get_or_create(user=user)
            profile_updates = []
            for field in candidate_fields & changes.keys():
                value = changes[field]
                if isinstance(value, str):
                    value = value.strip()
                if getattr(profile, field) != value:
                    setattr(profile, field, value)
                    profile_updates.append(field)
                    changed_fields.append(f'candidate.{field}')
            if profile_updates:
                profile.save(update_fields=[*profile_updates, 'updated_at'])
        elif user.is_employer:
            recruiter, _ = RecruiterProfile.objects.select_for_update().get_or_create(user=user)
            recruiter_updates = []
            for field in employer_fields & changes.keys():
                value = changes[field].strip()
                if getattr(recruiter, field) != value:
                    setattr(recruiter, field, value)
                    recruiter_updates.append(field)
                    changed_fields.append(f'employer.{field}')
            if 'work_location_id' in changes:
                location_id = changes['work_location_id']
                if location_id is not None and not Location.objects.filter(pk=location_id).exists():
                    raise ValidationError({'work_location_id': 'Địa điểm làm việc không tồn tại.'})
                if recruiter.work_location_id != location_id:
                    recruiter.work_location_id = location_id
                    recruiter_updates.append('work_location')
                    changed_fields.append('employer.work_location')
            if recruiter_updates:
                recruiter.save(update_fields=[*recruiter_updates, 'updated_at'])

        if changed_fields:
            record_admin_action(
                **_actor_kwargs(actor),
                action='update_account_profile',
                target_type='user',
                target_public_id=user.public_id,
                payload={
                    'user_public_id': user.public_id,
                    'changed_fields': sorted(changed_fields),
                },
            )
        return user


def _assert_revision(claims):
    if _current_revision() != claims['revision']:
        raise StaleImpactToken('Dữ liệu tài khoản đã thay đổi.')


def _group_status_counts(queryset, *fields):
    return [
        {
            **{field: row[field] for field in fields},
            'count': row['count'],
        }
        for row in queryset.values(*fields).annotate(count=Count('id')).order_by(*fields)
    ]


def _account_status_resource_snapshot(user):
    """Service-side copy of the selector contract used under row locks."""
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
            'campaigns': _group_status_counts(campaigns, 'status', 'policy_hold'),
            'jobs': _group_status_counts(jobs, 'status', 'policy_hold'),
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
            'applications': _group_status_counts(applications, 'status'),
            'application_count': applications.count(),
            'cv_count': user.cvs.filter(is_deleted=False).count(),
        }
    return snapshot


def ensure_account_recovery_allowed(actor, user, permission):
    ensure_account_write_allowed(actor, user, permission)
    if actor.pk == user.pk:
        raise ValidationError('Bạn không thể tự khôi phục danh tính tài khoản của mình.')
    if user.is_deleted:
        raise ValidationError('Tài khoản đã bị xóa và không thuộc luồng khôi phục này.')
    if user.status == User.Status.PENDING:
        raise ValidationError('Tài khoản đang chờ kích hoạt phải được xử lý qua quy trình lời mời.')


def _mfa_snapshot(user):
    methods = two_factor.enabled_methods(user)
    return {
        'email': methods['email'],
        'totp': methods['totp'],
        'backup_codes_remaining': len(user.two_factor_backup_code_hashes or []),
    }


def _email_recovery_snapshot(user, providers):
    return {
        'email': User.objects.normalize_email(user.email),
        'email_verified': bool(user.email_verified),
        'has_usable_password': user.has_usable_password(),
        'auth_revision': user.auth_revision,
        'oauth_providers': sorted(set(providers)),
        'mfa_methods': _mfa_snapshot(user),
    }


def _cancel_locked_jobs(jobs):
    cancelled = 0
    for job in jobs:
        if job.status != AuthEmailJob.Status.PENDING:
            continue
        job.status = AuthEmailJob.Status.CANCELLED
        job.save(update_fields=['status', 'updated_at'])
        cancelled += 1
    return cancelled


def confirm_account_email(
    user,
    *,
    email,
    reason,
    verification_evidence,
    impact_token,
    actor,
):
    from ..tasks import queue_auth_email
    from .verification_delivery import queue_verification_email

    email = User.objects.normalize_email(email)
    reason = _ensure_reason(reason)
    verification_evidence = _ensure_verification_evidence(verification_evidence)
    ensure_account_recovery_allowed(actor, user, 'account.email.manage')
    if User.objects.normalize_email(user.email) == email:
        raise ValidationError({'email': 'Email mới trùng với email hiện tại.'})
    if User.objects.email_claimed_for_role(
        email,
        user.role,
        exclude_user_id=user.pk,
    ):
        raise ValidationError({'email': 'Email này đã thuộc một tài khoản cùng loại.'})

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        ensure_account_recovery_allowed(actor, user, 'account.email.manage')
        sessions = list(
            AuthSession.objects.select_for_update().filter(
                user=user,
                revoked_at__isnull=True,
            )
        )
        social_accounts = list(user.social_accounts.select_for_update().all())
        jobs = list(
            AuthEmailJob.objects.select_for_update().filter(
                user=user,
                status=AuthEmailJob.Status.PENDING,
                kind__in={
                    AuthEmailJob.Kind.VERIFICATION,
                    AuthEmailJob.Kind.PASSWORD_RESET,
                    AuthEmailJob.Kind.TWO_FACTOR,
                },
            )
        )
        providers = [item.provider for item in social_accounts]
        before = _email_recovery_snapshot(user, providers)
        claims = decode_impact_token(
            impact_token,
            operation='account.email.change',
            resource_key=f'account:{user.public_id}',
            normalized_payload={
                'email': email,
                'reason': reason,
                'verification_evidence': verification_evidence,
                'before': before,
            },
        )
        if before['email'] == email:
            raise ValidationError({'email': 'Email mới trùng với email hiện tại.'})
        if User.objects.email_claimed_for_role(
            email,
            user.role,
            exclude_user_id=user.pk,
        ):
            raise ValidationError({'email': 'Email này đã thuộc một tài khoản cùng loại.'})
        _assert_revision(claims)

        old_email = user.email
        user.email = email
        user.email_verified = False
        user.set_unusable_password()
        user.auth_revision += 1
        try:
            with transaction.atomic():
                user.save(
                    update_fields=[
                        'email',
                        'email_verified',
                        'password',
                        'auth_revision',
                        'updated_at',
                    ]
                )
        except IntegrityError as error:
            raise ValidationError(
                {'email': 'Email này đã thuộc một tài khoản cùng loại.'}
            ) from error

        if social_accounts:
            user.social_accounts.filter(pk__in=[item.pk for item in social_accounts]).delete()
        cancelled_job_count = _cancel_locked_jobs(jobs)
        revoke_refresh_tokens(user)
        transaction.on_commit(lambda: password_reset.invalidate_tokens(user))
        transaction.on_commit(lambda: two_factor.invalidate_user_artifacts(user))

        queue_auth_email(
            AuthEmailJob.Kind.EMAIL_CHANGED_NOTICE,
            user,
            context={
                'recipient': old_email,
                'old_email': old_email,
                'new_email': email,
                'portal': user.role,
                'admin_initiated': True,
            },
        )
        queue_verification_email(user)
        record_admin_action(
            **_actor_kwargs(actor),
            action='change_account_email',
            target_type='user',
            target_public_id=user.public_id,
            payload={
                'user_public_id': user.public_id,
                'before_email': old_email,
                'after_email': email,
                'reason': reason,
                'verification_evidence': verification_evidence,
                'revoked_session_count': len(sessions),
                'revoked_oauth_providers': sorted(set(providers)),
                'cancelled_auth_email_job_count': cancelled_job_count,
                'password_invalidated': True,
                'auth_revision_after': user.auth_revision,
            },
        )
        return user


def confirm_reset_account_mfa(
    user,
    *,
    reason,
    verification_evidence,
    impact_token,
    actor,
):
    from ..tasks import queue_auth_email

    reason = _ensure_reason(reason)
    verification_evidence = _ensure_verification_evidence(verification_evidence)
    ensure_account_recovery_allowed(actor, user, 'account.mfa.reset')

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        ensure_account_recovery_allowed(actor, user, 'account.mfa.reset')
        sessions = list(
            AuthSession.objects.select_for_update().filter(
                user=user,
                revoked_at__isnull=True,
            )
        )
        jobs = list(
            AuthEmailJob.objects.select_for_update().filter(
                user=user,
                status=AuthEmailJob.Status.PENDING,
                kind__in={
                    AuthEmailJob.Kind.PASSWORD_RESET,
                    AuthEmailJob.Kind.TWO_FACTOR,
                },
            )
        )
        methods_before = _mfa_snapshot(user)
        claims = decode_impact_token(
            impact_token,
            operation='account.mfa.reset',
            resource_key=f'account:{user.public_id}',
            normalized_payload={
                'reason': reason,
                'verification_evidence': verification_evidence,
                'auth_revision': user.auth_revision,
                'methods': methods_before,
            },
        )
        _assert_revision(claims)
        if not (
            methods_before['email']
            or methods_before['totp']
            or methods_before['backup_codes_remaining']
        ):
            raise ValidationError('Tài khoản không có phương thức MFA nào để đặt lại.')

        user.two_factor_email_enabled = False
        user.two_factor_totp_secret = ''
        user.two_factor_backup_code_hashes = []
        user.two_factor_enabled = False
        user.auth_revision += 1
        user.save(
            update_fields=[
                'two_factor_email_enabled',
                'two_factor_totp_secret',
                'two_factor_backup_code_hashes',
                'two_factor_enabled',
                'auth_revision',
                'updated_at',
            ]
        )
        cancelled_job_count = _cancel_locked_jobs(jobs)
        revoke_refresh_tokens(user)
        transaction.on_commit(lambda: password_reset.invalidate_tokens(user))
        transaction.on_commit(lambda: two_factor.invalidate_user_artifacts(user))
        queue_auth_email(
            AuthEmailJob.Kind.MFA_RESET_NOTICE,
            user,
            context={
                'recipient': user.email,
                'portal': user.role,
                'occurred_at': timezone.now().isoformat(),
                'admin_initiated': True,
            },
        )
        record_admin_action(
            **_actor_kwargs(actor),
            action='reset_account_mfa',
            target_type='user',
            target_public_id=user.public_id,
            payload={
                'user_public_id': user.public_id,
                'methods_before': methods_before,
                'reason': reason,
                'verification_evidence': verification_evidence,
                'revoked_session_count': len(sessions),
                'cancelled_auth_email_job_count': cancelled_job_count,
                'auth_revision_after': user.auth_revision,
            },
        )
        return user


def _status_transition_kind(before, after):
    if after == User.Status.BANNED:
        return AccountStatusTransition.Kind.BAN
    if before == User.Status.BANNED and after == User.Status.INACTIVE:
        return AccountStatusTransition.Kind.BEGIN_REACTIVATION
    if after == User.Status.INACTIVE:
        return AccountStatusTransition.Kind.SUSPEND
    return AccountStatusTransition.Kind.REACTIVATE


def ensure_account_status_change_allowed(actor, user, status):
    ensure_account_write_allowed(actor, user, 'account.status.manage')
    if actor.pk == user.pk:
        raise ValidationError('Bạn không thể tự thay đổi trạng thái tài khoản của mình.')
    if user.is_deleted:
        raise ValidationError('Tài khoản đã bị xóa không thuộc workflow trạng thái này.')
    if user.status == User.Status.PENDING:
        raise ValidationError('Tài khoản đang chờ kích hoạt phải được xử lý qua workflow lời mời.')
    allowed = {
        User.Status.ACTIVE: {User.Status.INACTIVE, User.Status.BANNED},
        User.Status.INACTIVE: {User.Status.ACTIVE, User.Status.BANNED},
        User.Status.BANNED: {User.Status.INACTIVE},
    }
    if status not in allowed.get(user.status, set()):
        raise ValidationError({'status': 'Không thể chuyển trực tiếp giữa hai trạng thái đã chọn.'})
    if status == User.Status.BANNED or user.status == User.Status.BANNED:
        if not actor.is_superuser:
            raise AdminPermissionDenied(
                'Cấm hoặc bắt đầu khôi phục tài khoản bị cấm chỉ dành cho superuser.'
            )


def confirm_account_status(
    user,
    *,
    status,
    reason,
    impact_token,
    actor,
    enforcement_evidence='',
    violation_category='',
):
    return _confirm_account_status(
        user,
        status=status,
        reason=reason,
        enforcement_evidence=enforcement_evidence,
        violation_category=violation_category,
        impact_token=impact_token,
        actor=actor,
    )


def _confirm_account_status(
    user,
    *,
    status,
    reason,
    enforcement_evidence,
    violation_category,
    impact_token,
    actor,
):
    from ..tasks import queue_auth_email

    reason = _ensure_reason(reason)
    enforcement_evidence = (enforcement_evidence or '').strip()
    violation_category = (violation_category or '').strip()
    ensure_account_status_change_allowed(actor, user, status)
    if status == User.Status.BANNED or user.status == User.Status.BANNED:
        enforcement_evidence = _ensure_verification_evidence(enforcement_evidence)
    if status == User.Status.BANNED and (
        violation_category not in AccountStatusTransition.ViolationCategory.values
    ):
        raise ValidationError({'violation_category': 'Chọn nhóm vi phạm khi cấm tài khoản.'})

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        ensure_account_status_change_allowed(actor, user, status)
        sessions = list(
            AuthSession.objects.select_for_update().filter(user=user, revoked_at__isnull=True)
        )
        pending_jobs = list(
            AuthEmailJob.objects.select_for_update().filter(
                user=user,
                status=AuthEmailJob.Status.PENDING,
                kind__in={
                    AuthEmailJob.Kind.VERIFICATION,
                    AuthEmailJob.Kind.PASSWORD_RESET,
                    AuthEmailJob.Kind.TWO_FACTOR,
                },
            )
        )
        campaign_ids = list(
            RecruitmentCampaign.objects.select_for_update()
            .filter(owner__user=user)
            .values_list('pk', flat=True)
        )
        job_ids = list(
            Job.objects.select_for_update().filter(posted_by=user).values_list('pk', flat=True)
        )
        snapshot = _account_status_resource_snapshot(user)
        claims = decode_impact_token(
            impact_token,
            operation='account.status.change',
            resource_key=f'account:{user.public_id}',
            normalized_payload={
                'status': status,
                'reason': reason,
                'enforcement_evidence': enforcement_evidence,
                'violation_category': violation_category,
                'snapshot': snapshot,
            },
        )
        _assert_revision(claims)
        if user.is_superuser and status != User.Status.ACTIVE:
            remaining = User.objects.filter(
                role=User.Role.ADMIN,
                is_superuser=True,
                status=User.Status.ACTIVE,
                is_active=True,
                is_deleted=False,
            ).exclude(pk=user.pk)
            if not remaining.exists():
                raise ValidationError('Không thể khóa superuser hoạt động cuối cùng.')
        before = user.status
        kind = _status_transition_kind(before, status)

        if status == User.Status.ACTIVE and user.role == User.Role.EMPLOYER:
            if (
                RecruitmentCampaign.objects.filter(
                    pk__in=campaign_ids,
                    policy_hold__in={
                        RecruitmentCampaign.PolicyHold.BAN_REVIEW,
                        RecruitmentCampaign.PolicyHold.LEGACY_LOCK,
                    },
                ).exists()
                or Job.objects.filter(
                    pk__in=job_ids,
                    policy_hold__in={Job.PolicyHold.BAN_REVIEW, Job.PolicyHold.LEGACY_LOCK},
                ).exists()
            ):
                raise ValidationError(
                    'Cần rà soát và gỡ policy hold của tài nguyên trước khi mở lại tài khoản.'
                )

        now = timezone.now()
        held_campaign_count = 0
        held_job_count = 0
        released_campaign_count = 0
        released_job_count = 0
        campaign_hold = None
        job_hold = None
        campaign_qs = None
        job_qs = None
        release_campaign_qs = None
        release_job_qs = None
        activity_campaign_ids = []
        if user.role == User.Role.EMPLOYER and status == User.Status.BANNED:
            campaign_hold = RecruitmentCampaign.PolicyHold.BAN_REVIEW
            job_hold = Job.PolicyHold.BAN_REVIEW
            campaign_qs = RecruitmentCampaign.objects.filter(
                pk__in=campaign_ids,
                status__in={
                    RecruitmentCampaign.Status.DRAFT,
                    RecruitmentCampaign.Status.ACTIVE,
                    RecruitmentCampaign.Status.PAUSED,
                },
            )
            job_qs = Job.objects.filter(
                pk__in=job_ids,
                status__in={Job.Status.DRAFT, Job.Status.PENDING, Job.Status.ACTIVE},
            )
            held_campaign_count = campaign_qs.count()
            held_job_count = job_qs.count()
            activity_campaign_ids = list(campaign_qs.values_list('pk', flat=True))
        elif (
            user.role == User.Role.EMPLOYER
            and status == User.Status.INACTIVE
            and before != User.Status.BANNED
        ):
            campaign_hold = RecruitmentCampaign.PolicyHold.TEMPORARY_LOCK
            job_hold = Job.PolicyHold.TEMPORARY_LOCK
            campaign_qs = RecruitmentCampaign.objects.filter(
                pk__in=campaign_ids,
                policy_hold=RecruitmentCampaign.PolicyHold.NONE,
                status__in={
                    RecruitmentCampaign.Status.DRAFT,
                    RecruitmentCampaign.Status.ACTIVE,
                    RecruitmentCampaign.Status.PAUSED,
                },
            )
            job_qs = Job.objects.filter(
                pk__in=job_ids,
                policy_hold=Job.PolicyHold.NONE,
                status__in={Job.Status.DRAFT, Job.Status.PENDING, Job.Status.ACTIVE},
            )
            held_campaign_count = campaign_qs.count()
            held_job_count = job_qs.count()
            activity_campaign_ids = list(campaign_qs.values_list('pk', flat=True))
        elif user.role == User.Role.EMPLOYER and status == User.Status.ACTIVE:
            release_campaign_qs = RecruitmentCampaign.objects.filter(
                pk__in=campaign_ids,
                policy_hold=RecruitmentCampaign.PolicyHold.TEMPORARY_LOCK,
            )
            release_job_qs = Job.objects.filter(
                pk__in=job_ids,
                policy_hold=Job.PolicyHold.TEMPORARY_LOCK,
            )
            released_campaign_count = release_campaign_qs.count()
            released_job_count = release_job_qs.count()
            activity_campaign_ids = list(release_campaign_qs.values_list('pk', flat=True))

        revoked = len(sessions) if status != User.Status.ACTIVE else 0
        effect_summary = {
            'revoked_session_count': revoked,
            'held_campaign_count': held_campaign_count,
            'held_job_count': held_job_count,
            'released_campaign_count': released_campaign_count,
            'released_job_count': released_job_count,
            'campaign_hold': campaign_hold,
            'job_hold': job_hold,
            'business_statuses_changed': False,
            'auth_revision_after': user.auth_revision + (1 if status != User.Status.ACTIVE else 0),
        }
        transition = AccountStatusTransition.objects.create(
            user=user,
            actor=actor,
            kind=kind,
            before_status=before,
            after_status=status,
            reason=reason,
            enforcement_evidence=enforcement_evidence,
            violation_category=violation_category,
            resource_snapshot=snapshot,
            effect_summary=effect_summary,
        )
        if campaign_qs is not None:
            campaign_qs.update(
                policy_hold=campaign_hold,
                policy_held_at=now,
                policy_hold_transition=transition,
            )
        if job_qs is not None:
            job_qs.update(
                policy_hold=job_hold,
                policy_held_at=now,
                policy_hold_transition=transition,
            )
        if release_campaign_qs is not None:
            release_campaign_qs.update(
                policy_hold=RecruitmentCampaign.PolicyHold.NONE,
                policy_held_at=None,
                policy_hold_transition=None,
            )
        if release_job_qs is not None:
            release_job_qs.update(
                policy_hold=Job.PolicyHold.NONE,
                policy_held_at=None,
                policy_hold_transition=None,
            )

        user.status = status
        user.is_active = status == User.Status.ACTIVE
        if status != User.Status.ACTIVE:
            user.auth_revision += 1
        user.save(update_fields=['status', 'is_active', 'auth_revision', 'updated_at'])
        if status != User.Status.ACTIVE:
            revoke_refresh_tokens(user)
            _cancel_locked_jobs(pending_jobs)
            transaction.on_commit(lambda: password_reset.invalidate_tokens(user))
            transaction.on_commit(lambda: two_factor.invalidate_user_artifacts(user))

        if activity_campaign_ids:
            event_type = (
                CampaignActivity.EventType.ACCOUNT_POLICY_HELD
                if campaign_hold
                else CampaignActivity.EventType.ACCOUNT_POLICY_RELEASED
            )
            CampaignActivity.objects.bulk_create(
                [
                    CampaignActivity(
                        campaign_id=campaign_id,
                        actor=actor,
                        group=CampaignActivity.Group.CAMPAIGN,
                        event_type=event_type,
                        metadata={
                            'reason': 'account_status_policy_hold',
                            'policy_hold': campaign_hold or '',
                            'transition_public_id': transition.public_id,
                        },
                        occurred_at=now,
                    )
                    for campaign_id in activity_campaign_ids
                ]
            )

        queue_auth_email(
            AuthEmailJob.Kind.ACCOUNT_STATUS_NOTICE,
            user,
            context={
                'recipient': user.email,
                'portal': user.role,
                'before_status': before,
                'after_status': status,
                'occurred_at': now.isoformat(),
                'admin_initiated': True,
            },
        )
        action_name = {
            AccountStatusTransition.Kind.SUSPEND: 'temporarily_suspend_account',
            AccountStatusTransition.Kind.BAN: 'ban_account',
            AccountStatusTransition.Kind.BEGIN_REACTIVATION: 'begin_account_reactivation',
            AccountStatusTransition.Kind.REACTIVATE: 'reactivate_account',
        }[kind]
        record_admin_action(
            **_actor_kwargs(actor),
            action=action_name,
            target_type='user',
            target_public_id=user.public_id,
            payload={
                'user_public_id': user.public_id,
                'transition_public_id': transition.public_id,
                'before': before,
                'after': status,
                'reason': reason,
                'enforcement_evidence': enforcement_evidence,
                'violation_category': violation_category,
                'revoked_session_count': revoked,
                **effect_summary,
            },
        )
        transaction.on_commit(lambda: bust_admin_permission_cache({user.pk}))
        return user


def confirm_release_account_resource_holds(
    user,
    *,
    reason,
    enforcement_evidence,
    impact_token,
    actor,
):
    reason = _ensure_reason(reason)
    enforcement_evidence = _ensure_verification_evidence(enforcement_evidence)
    ensure_account_write_allowed(actor, user, 'account.resource_hold.release')
    if not actor.is_superuser:
        raise AdminPermissionDenied('Gỡ policy hold chỉ dành cho superuser.')
    if actor.pk == user.pk:
        raise ValidationError('Bạn không thể tự gỡ policy hold của tài khoản mình.')

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        if (
            user.is_deleted
            or user.role != User.Role.EMPLOYER
            or user.status != User.Status.INACTIVE
        ):
            raise ValidationError(
                'Chỉ được gỡ policy hold cho tài khoản nhà tuyển dụng đang tạm khóa.'
            )
        campaign_ids = list(
            RecruitmentCampaign.objects.select_for_update()
            .filter(owner__user=user)
            .values_list('pk', flat=True)
        )
        job_ids = list(
            Job.objects.select_for_update().filter(posted_by=user).values_list('pk', flat=True)
        )
        snapshot = _account_status_resource_snapshot(user)
        claims = decode_impact_token(
            impact_token,
            operation='account.resource_hold.release',
            resource_key=f'account:{user.public_id}',
            normalized_payload={
                'reason': reason,
                'enforcement_evidence': enforcement_evidence,
                'snapshot': snapshot,
            },
        )
        _assert_revision(claims)
        releasable_campaign_holds = {
            RecruitmentCampaign.PolicyHold.BAN_REVIEW,
            RecruitmentCampaign.PolicyHold.LEGACY_LOCK,
        }
        releasable_job_holds = {Job.PolicyHold.BAN_REVIEW, Job.PolicyHold.LEGACY_LOCK}
        campaign_count = RecruitmentCampaign.objects.filter(
            pk__in=campaign_ids,
            policy_hold__in=releasable_campaign_holds,
        ).count()
        job_count = Job.objects.filter(
            pk__in=job_ids,
            policy_hold__in=releasable_job_holds,
        ).count()
        if not campaign_count and not job_count:
            raise ValidationError('Tài khoản không còn policy hold cần gỡ.')
        released_campaign_ids = list(
            RecruitmentCampaign.objects.filter(
                pk__in=campaign_ids,
                policy_hold__in=releasable_campaign_holds,
            ).values_list('pk', flat=True)
        )
        transition = AccountStatusTransition.objects.create(
            user=user,
            actor=actor,
            kind=AccountStatusTransition.Kind.RELEASE_RESOURCE_HOLDS,
            before_status=user.status,
            after_status=user.status,
            reason=reason,
            enforcement_evidence=enforcement_evidence,
            resource_snapshot=snapshot,
            effect_summary={
                'released_campaign_count': campaign_count,
                'released_job_count': job_count,
                'account_status_changed': False,
                'business_statuses_changed': False,
            },
        )
        RecruitmentCampaign.objects.filter(
            pk__in=campaign_ids,
            policy_hold__in=releasable_campaign_holds,
        ).update(
            policy_hold=RecruitmentCampaign.PolicyHold.NONE,
            policy_held_at=None,
            policy_hold_transition=None,
        )
        Job.objects.filter(
            pk__in=job_ids,
            policy_hold__in=releasable_job_holds,
        ).update(
            policy_hold=Job.PolicyHold.NONE,
            policy_held_at=None,
            policy_hold_transition=None,
        )
        now = timezone.now()
        CampaignActivity.objects.bulk_create(
            [
                CampaignActivity(
                    campaign_id=campaign_id,
                    actor=actor,
                    group=CampaignActivity.Group.CAMPAIGN,
                    event_type=CampaignActivity.EventType.ACCOUNT_POLICY_RELEASED,
                    metadata={
                        'reason': 'account_resource_review_completed',
                        'transition_public_id': transition.public_id,
                    },
                    occurred_at=now,
                )
                for campaign_id in released_campaign_ids
            ]
        )
        record_admin_action(
            **_actor_kwargs(actor),
            action='release_account_resource_hold',
            target_type='user',
            target_public_id=user.public_id,
            payload={
                'user_public_id': user.public_id,
                'transition_public_id': transition.public_id,
                'reason': reason,
                'enforcement_evidence': enforcement_evidence,
                'released_campaign_count': campaign_count,
                'released_job_count': job_count,
                'account_status_changed': False,
                'business_statuses_changed': False,
            },
        )
        return user


def confirm_revoke_account_sessions(user, *, reason, impact_token, actor):
    reason = _ensure_reason(reason)
    ensure_account_write_allowed(actor, user, 'account.security.manage')
    claims = decode_impact_token(
        impact_token,
        operation='account.sessions.revoke',
        resource_key=f'account:{user.public_id}',
        normalized_payload={'reason': reason},
    )
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        sessions = list(
            AuthSession.objects.select_for_update().filter(user=user, revoked_at__isnull=True)
        )
        _assert_revision(claims)
        for session in sessions:
            auth_sessions.revoke_session(session)
        record_admin_action(
            **_actor_kwargs(actor),
            action='revoke_account_sessions',
            target_type='user',
            target_public_id=user.public_id,
            payload={
                'user_public_id': user.public_id,
                'reason': reason,
                'revoked_session_count': len(sessions),
            },
        )
        return len(sessions)


def queue_account_security_email(user, *, kind, actor, reason=None):
    from ..tasks import queue_auth_email
    from .password_reset import is_reset_eligible

    audit_reason = (
        _ensure_reason(reason)
        if kind == AuthEmailJob.Kind.PASSWORD_RESET
        else (reason or '').strip()
    )
    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        ensure_account_write_allowed(actor, user, 'account.security.manage')
        if kind == AuthEmailJob.Kind.VERIFICATION and user.email_verified:
            raise ValidationError('Email của tài khoản đã được xác minh.')
        if kind == AuthEmailJob.Kind.PASSWORD_RESET and not is_reset_eligible(user):
            raise ValidationError(
                'Chỉ có thể gửi liên kết đặt lại mật khẩu cho tài khoản đang hoạt động. '
                'Hãy mở khóa tài khoản trước.'
            )
        job = queue_auth_email(kind, user)
        record_admin_action(
            **_actor_kwargs(actor),
            action=(
                'send_account_password_reset'
                if kind == AuthEmailJob.Kind.PASSWORD_RESET
                else 'resend_account_verification'
            ),
            target_type='user',
            target_public_id=user.public_id,
            payload={
                'user_public_id': user.public_id,
                **({'reason': audit_reason} if audit_reason else {}),
            },
        )
        return job

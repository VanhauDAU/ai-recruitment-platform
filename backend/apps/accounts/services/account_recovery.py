"""Administrator identity recovery: replacing an account email after verification."""

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.accounts.domain.impact_token_rules import decode_impact_token

from ..models import (
    AuthEmailJob,
    AuthSession,
    User,
)
from . import password_reset
from .admin_account_common import (
    admin_actor_kwargs,
    assert_audit_revision,
    cancel_pending_auth_email_jobs,
    clean_admin_reason,
    clean_verification_evidence,
    ensure_account_write_allowed,
)
from .admin_audit import record_admin_action
from .tokens import revoke_refresh_tokens


def ensure_account_recovery_allowed(actor, user):
    ensure_account_write_allowed(actor, user)
    if actor.pk == user.pk:
        raise ValidationError('Bạn không thể tự khôi phục danh tính tài khoản của mình.')
    if user.is_deleted:
        raise ValidationError('Tài khoản đã bị xóa và không thuộc luồng khôi phục này.')
    if user.status == User.Status.PENDING:
        raise ValidationError('Tài khoản đang chờ kích hoạt phải được xử lý qua quy trình lời mời.')


def _email_recovery_snapshot(user, providers):
    return {
        'email': User.objects.normalize_email(user.email),
        'email_verified': bool(user.email_verified),
        'has_usable_password': user.has_usable_password(),
        'auth_revision': user.auth_revision,
        'oauth_providers': sorted(set(providers)),
    }


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
    reason = clean_admin_reason(reason)
    verification_evidence = clean_verification_evidence(verification_evidence)
    ensure_account_recovery_allowed(actor, user)
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
        ensure_account_recovery_allowed(actor, user)
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
        assert_audit_revision(claims)

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
        cancelled_job_count = cancel_pending_auth_email_jobs(jobs)
        revoke_refresh_tokens(user)
        transaction.on_commit(lambda: password_reset.invalidate_tokens(user))

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
            **admin_actor_kwargs(actor),
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

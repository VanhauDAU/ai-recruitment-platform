"""Account status transitions (suspend, ban, reactivate) and their resource holds."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.accounts.domain.impact_token_rules import decode_impact_token
from apps.accounts.services.exceptions import AdminPermissionDenied
from apps.campaigns.models import CampaignActivity, RecruitmentCampaign
from apps.jobs.models import Job, give_back_hidden_time

from ..models import (
    AccountStatusTransition,
    AuthEmailJob,
    AuthSession,
    User,
    account_status_resource_snapshot,
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


def _status_transition_kind(before, after):
    if after == User.Status.BANNED:
        return AccountStatusTransition.Kind.BAN
    if before == User.Status.BANNED and after == User.Status.INACTIVE:
        return AccountStatusTransition.Kind.BEGIN_REACTIVATION
    if after == User.Status.INACTIVE:
        return AccountStatusTransition.Kind.SUSPEND
    return AccountStatusTransition.Kind.REACTIVATE


def ensure_account_status_change_allowed(actor, user, status):
    ensure_account_write_allowed(actor, user)
    if actor.pk == user.pk:
        raise ValidationError(_('Bạn không thể tự thay đổi trạng thái tài khoản của mình.'))
    if user.is_deleted:
        raise ValidationError(_('Tài khoản đã bị xóa không thuộc workflow trạng thái này.'))
    if user.status == User.Status.PENDING:
        raise ValidationError(
            _('Tài khoản đang chờ kích hoạt phải được xử lý qua workflow lời mời.')
        )
    allowed = {
        User.Status.ACTIVE: {User.Status.INACTIVE, User.Status.BANNED},
        User.Status.INACTIVE: {User.Status.ACTIVE, User.Status.BANNED},
        User.Status.BANNED: {User.Status.INACTIVE},
    }
    if status not in allowed.get(user.status, set()):
        raise ValidationError(
            {'status': _('Không thể chuyển trực tiếp giữa hai trạng thái đã chọn.')}
        )
    if status == User.Status.BANNED or user.status == User.Status.BANNED:
        if not actor.is_superuser:
            raise AdminPermissionDenied(
                _('Cấm hoặc bắt đầu khôi phục tài khoản bị cấm chỉ dành cho superuser.')
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
    from ..tasks import queue_auth_email

    reason = clean_admin_reason(reason)
    enforcement_evidence = (enforcement_evidence or '').strip()
    violation_category = (violation_category or '').strip()
    ensure_account_status_change_allowed(actor, user, status)
    if status == User.Status.BANNED or user.status == User.Status.BANNED:
        enforcement_evidence = clean_verification_evidence(enforcement_evidence)
    if status == User.Status.BANNED and (
        violation_category not in AccountStatusTransition.ViolationCategory.values
    ):
        raise ValidationError({'violation_category': _('Chọn nhóm vi phạm khi cấm tài khoản.')})

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
        snapshot = account_status_resource_snapshot(user)
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
        assert_audit_revision(claims)
        if user.is_superuser and status != User.Status.ACTIVE:
            remaining = User.objects.filter(
                role=User.Role.ADMIN,
                is_superuser=True,
                status=User.Status.ACTIVE,
                is_active=True,
                is_deleted=False,
            ).exclude(pk=user.pk)
            if not remaining.exists():
                raise ValidationError(_('Không thể khóa superuser hoạt động cuối cùng.'))
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
                    _('Cần rà soát và gỡ policy hold của tài nguyên trước khi mở lại tài khoản.')
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
                status__in=RecruitmentCampaign.NON_TERMINAL_STATUSES,
            )
            job_qs = Job.objects.filter(
                pk__in=job_ids,
                status__in={Job.Status.DRAFT, Job.Status.ACTIVE},
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
                status__in=RecruitmentCampaign.NON_TERMINAL_STATUSES,
            )
            job_qs = Job.objects.filter(
                pk__in=job_ids,
                policy_hold=Job.PolicyHold.NONE,
                status__in={Job.Status.DRAFT, Job.Status.ACTIVE},
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
            give_back_hidden_time(release_job_qs, since=F('policy_held_at'), now=now)
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
            cancel_pending_auth_email_jobs(pending_jobs)
            transaction.on_commit(lambda: password_reset.invalidate_tokens(user))

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
            **admin_actor_kwargs(actor),
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
        return user

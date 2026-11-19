"""Releasing ban-review holds left on an employer's campaigns and jobs."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.accounts.domain.impact_token_rules import decode_impact_token
from apps.accounts.services.exceptions import AdminPermissionDenied
from apps.campaigns.models import CampaignActivity, RecruitmentCampaign
from apps.jobs.models import Job, give_back_hidden_time

from ..models import (
    AccountStatusTransition,
    User,
    account_status_resource_snapshot,
)
from .admin_account_common import (
    admin_actor_kwargs,
    assert_audit_revision,
    clean_admin_reason,
    clean_verification_evidence,
    ensure_account_write_allowed,
)
from .admin_audit import record_admin_action


def confirm_release_account_resource_holds(
    user,
    *,
    reason,
    enforcement_evidence,
    impact_token,
    actor,
):
    reason = clean_admin_reason(reason)
    enforcement_evidence = clean_verification_evidence(enforcement_evidence)
    ensure_account_write_allowed(actor, user)
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
        snapshot = account_status_resource_snapshot(user)
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
        assert_audit_revision(claims)
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
        released_jobs = Job.objects.filter(pk__in=job_ids, policy_hold__in=releasable_job_holds)
        give_back_hidden_time(released_jobs, since=F('policy_held_at'), now=timezone.now())
        released_jobs.update(
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
            **admin_actor_kwargs(actor),
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

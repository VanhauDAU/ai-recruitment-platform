"""Date-driven campaign lifecycle run by Celery beat (Vietnam calendar days)."""

import hashlib
import json
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy
from rest_framework.exceptions import APIException

from apps.campaigns.models import CampaignActivity, RecruitmentCampaign
from apps.employers.models import EmployerNotification
from apps.employers.services import emit_employer_event, ensure_recruiter_job_workspace
from common.i18n import recipient_language
from common.portal_paths import employer_app_path
from common.vietnam_time import vietnam_today

from ..models import CampaignLaunchPlan
from .campaigns import apply_system_campaign_status
from .launch import execute_launch

logger = logging.getLogger(__name__)
Status = RecruitmentCampaign.Status
ENDING_SOON_DAYS = 3


def _campaign_path(campaign):
    return employer_app_path(f'/chien-dich/{campaign.public_id}')


def _notify(campaign, event_type, dedupe_key, message, **params):
    """``message`` is a lazy msgid, rendered in the owner's language with ``params``."""
    recipient = campaign.owner.user
    with recipient_language(recipient):
        emit_employer_event(
            recipient=recipient,
            event_type=event_type,
            dedupe_key=dedupe_key,
            message=str(message) % {'campaign': campaign.name, **params},
            subject_public_id=campaign.public_id,
            metadata={'campaign_public_id': campaign.public_id},
            action_path=_campaign_path(campaign),
        )


def _error_payload(error):
    detail = error.detail if hasattr(error, 'detail') else str(error)
    return json.loads(json.dumps(detail, default=str))


def _activate(campaign_id, today):
    campaign = RecruitmentCampaign.objects.select_related('owner__user').get(pk=campaign_id)
    user = campaign.owner.user
    with transaction.atomic():
        ensure_recruiter_job_workspace(user, lock=True)
        campaign = (
            RecruitmentCampaign.objects.select_for_update(of=('self',))
            .select_related('owner__user')
            .get(pk=campaign_id)
        )
        if campaign.status != Status.SCHEDULED or campaign.policy_hold:
            return False
        plan = CampaignLaunchPlan.objects.filter(campaign=campaign).first()
        execute_launch(
            campaign,
            user=user,
            actor=None,
            accepted_statement_version=plan.accepted_statement_version if plan else '',
            today=today,
        )
        _notify(
            campaign,
            EmployerNotification.EventType.CAMPAIGN_ACTIVATED,
            f'campaign-activated:{campaign.public_id}',
            gettext_lazy('Chiến dịch "%(campaign)s" đã bắt đầu chạy theo lịch.'),
        )
    return True


@transaction.atomic
def _record_activation_failure(campaign_id, error):
    campaign = (
        RecruitmentCampaign.objects.select_for_update(of=('self',))
        .select_related('owner__user')
        .get(pk=campaign_id)
    )
    payload = _error_payload(error)
    fingerprint = hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()[:16]
    plan, _created = CampaignLaunchPlan.objects.get_or_create(campaign=campaign)
    is_new_error = plan.last_error.get('fingerprint') != fingerprint
    plan.last_error = {'fingerprint': fingerprint, 'error': payload}
    plan.last_error_at = timezone.now()
    plan.save(update_fields=['last_error', 'last_error_at', 'updated_at'])
    if not is_new_error:
        return
    CampaignActivity.objects.record(
        campaign=campaign,
        event_type=CampaignActivity.EventType.CAMPAIGN_ACTIVATION_FAILED,
        group=CampaignActivity.Group.CAMPAIGN,
        metadata={'code': payload.get('code', '') if isinstance(payload, dict) else ''},
    )
    _notify(
        campaign,
        EmployerNotification.EventType.CAMPAIGN_ACTIVATION_FAILED,
        f'campaign-activation-failed:{campaign.public_id}:{fingerprint}',
        gettext_lazy(
            'Chiến dịch "%(campaign)s" chưa chạy được theo lịch. Mở chiến dịch để xem cần sửa gì.'
        ),
    )


@transaction.atomic
def _complete(campaign_id):
    campaign = (
        RecruitmentCampaign.objects.select_for_update(of=('self',))
        .select_related('owner__user')
        .get(pk=campaign_id)
    )
    if campaign.status not in {Status.ACTIVE, Status.PAUSED} or campaign.policy_hold:
        return False
    apply_system_campaign_status(
        campaign=campaign,
        status=Status.COMPLETED,
        metadata={'reason': 'target_date_passed'},
    )
    _notify(
        campaign,
        EmployerNotification.EventType.CAMPAIGN_AUTO_COMPLETED,
        f'campaign-auto-completed:{campaign.public_id}',
        gettext_lazy(
            'Chiến dịch "%(campaign)s" đã qua ngày kết thúc nên tự hoàn tất; '
            'các tin đã ngừng tuyển.'
        ),
    )
    return True


def run_campaign_schedule(*, today=None):
    """Activate due scheduled campaigns, end expired ones, warn three days ahead.

    Idempotent: each step re-checks state under the row lock, and notifications
    carry a dedupe key, so overlapping or repeated beats change nothing.
    """
    today = today or vietnam_today()
    unheld = RecruitmentCampaign.objects.filter(policy_hold=RecruitmentCampaign.PolicyHold.NONE)
    result = {'activated': 0, 'activation_failed': 0, 'completed': 0, 'ending_soon': 0}
    due = unheld.filter(status=Status.SCHEDULED, start_date__lte=today)
    for campaign_id in due.values_list('pk', flat=True):
        try:
            result['activated'] += int(_activate(campaign_id, today))
        except APIException as error:
            _record_activation_failure(campaign_id, error)
            result['activation_failed'] += 1
    expired = unheld.filter(
        status__in=[Status.ACTIVE, Status.PAUSED], is_continuous=False, target_date__lt=today
    )
    for campaign_id in expired.values_list('pk', flat=True):
        result['completed'] += int(_complete(campaign_id))
    ending = unheld.filter(
        status=Status.ACTIVE,
        is_continuous=False,
        target_date=today + timedelta(days=ENDING_SOON_DAYS),
    ).select_related('owner__user')
    for campaign in ending:
        with transaction.atomic():
            _notify(
                campaign,
                EmployerNotification.EventType.CAMPAIGN_ENDING_SOON,
                f'campaign-ending-soon:{campaign.public_id}:{campaign.target_date.isoformat()}',
                gettext_lazy(
                    'Chiến dịch "%(campaign)s" kết thúc ngày %(date)s. Gia hạn nếu cần tuyển tiếp.'
                ),
                date=f'{campaign.target_date:%d/%m/%Y}',
            )
        result['ending_soon'] += 1
    if any(result.values()):
        logger.info('campaign_schedule_run', extra=result)
    return result

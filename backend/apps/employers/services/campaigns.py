from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from common.vietnam_time import vietnam_today

from ..models import CampaignActivity, RecruitmentCampaign
from ..signals import campaign_status_changed
from .profiles import ensure_recruiter_job_workspace


def _recruiter_for(user):
    recruiter, _ = ensure_recruiter_job_workspace(user, lock=True)
    return recruiter


def _ensure_campaign_not_held(campaign):
    if campaign.policy_hold:
        raise ValidationError(
            {
                'code': 'RECRUITMENT_HOLD_ACTIVE',
                'detail': 'Chiến dịch đang bị policy hold.',
            }
        )


def record_campaign_activity(
    *,
    campaign,
    event_type,
    group,
    actor=None,
    subject_public_id='',
    metadata=None,
    occurred_at=None,
):
    """Record one explicit campaign-domain event from a mutation service."""
    if campaign is None:
        return None
    activity = CampaignActivity.objects.create(
        campaign=campaign,
        actor=actor,
        group=group,
        event_type=event_type,
        subject_public_id=subject_public_id or '',
        metadata=metadata or {},
        occurred_at=occurred_at or timezone.now(),
    )
    # Keep create/update/status API responses consistent with a subsequent GET
    # without adding a read query solely to annotate the just-written event.
    campaign.last_activity_at = activity.occurred_at
    campaign.last_activity_type = activity.event_type
    return activity


Status = RecruitmentCampaign.Status

# Activation only happens through the launch flow (``apps.campaigns``), which
# checks goals, jobs and publication gates first; this map is what a recruiter
# may do directly from the status endpoint.
USER_STATUS_TRANSITIONS = {
    Status.DRAFT: {Status.CANCELLED},
    Status.SCHEDULED: {Status.DRAFT, Status.CANCELLED},
    Status.ACTIVE: {Status.PAUSED, Status.COMPLETED, Status.CANCELLED},
    Status.PAUSED: {Status.ACTIVE, Status.COMPLETED, Status.CANCELLED},
    Status.COMPLETED: set(),
    Status.CANCELLED: set(),
}
SYSTEM_STATUS_TRANSITIONS = {
    Status.DRAFT: {Status.ACTIVE, Status.SCHEDULED},
    Status.SCHEDULED: {Status.ACTIVE},
    Status.ACTIVE: {Status.COMPLETED},
    Status.PAUSED: {Status.COMPLETED},
}
STATUS_EVENTS = {
    Status.DRAFT: CampaignActivity.EventType.CAMPAIGN_UNSCHEDULED,
    Status.SCHEDULED: CampaignActivity.EventType.CAMPAIGN_SCHEDULED,
    Status.PAUSED: CampaignActivity.EventType.CAMPAIGN_PAUSED,
    Status.COMPLETED: CampaignActivity.EventType.CAMPAIGN_COMPLETED,
    Status.CANCELLED: CampaignActivity.EventType.CAMPAIGN_CANCELLED,
}


def campaign_active_seconds(campaign, *, now=None):
    """Seconds the campaign has actually been running, pauses excluded."""
    seconds = campaign.active_seconds_accumulated
    if campaign.status == Status.ACTIVE and campaign.activated_at:
        seconds += max(0, int(((now or timezone.now()) - campaign.activated_at).total_seconds()))
    return seconds


def _set_status(campaign, status, *, actor, ended_by, metadata=None):
    """Apply one transition with its running-time bookkeeping and side effects."""
    now = timezone.now()
    previous = campaign.status
    update_fields = ['status', 'updated_at']
    if previous == Status.ACTIVE:
        campaign.active_seconds_accumulated = campaign_active_seconds(campaign, now=now)
        update_fields.append('active_seconds_accumulated')
    if status == Status.ACTIVE:
        campaign.first_activated_at = campaign.first_activated_at or now
        campaign.activated_at = now
        update_fields += ['first_activated_at', 'activated_at']
    if status in RecruitmentCampaign.TERMINAL_STATUSES:
        campaign.ended_at = now
        campaign.ended_by = ended_by
        update_fields += ['ended_at', 'ended_by']
    campaign.status = status
    campaign.save(update_fields=update_fields)
    campaign_status_changed.send(
        sender=RecruitmentCampaign, campaign=campaign, previous_status=previous, actor=actor
    )
    if status == Status.ACTIVE:
        event_type = (
            CampaignActivity.EventType.CAMPAIGN_RESUMED
            if previous == Status.PAUSED
            else CampaignActivity.EventType.CAMPAIGN_ACTIVATED
        )
    else:
        event_type = STATUS_EVENTS[status]
    record_campaign_activity(
        campaign=campaign,
        event_type=event_type,
        group=CampaignActivity.Group.CAMPAIGN,
        actor=actor,
        metadata={'status': status, 'from_status': previous, **(metadata or {})},
    )
    return campaign


def _ensure_resumable(campaign):
    if (
        not campaign.is_continuous
        and campaign.target_date
        and campaign.target_date < vietnam_today()
    ):
        raise ValidationError(
            {
                'target_date': 'Chiến dịch đã qua ngày kết thúc. Gia hạn ngày kết thúc trước khi mở lại.'
            }
        )


@transaction.atomic
def create_campaign(*, user, activate=False, **data):
    """Create a campaign as a draft to set up, or active for inline job-form creation."""
    recruiter = _recruiter_for(user)
    campaign = RecruitmentCampaign.objects.create(
        owner=recruiter,
        company=recruiter.company,
        status=Status.DRAFT,
        **data,
    )
    record_campaign_activity(
        campaign=campaign,
        event_type=CampaignActivity.EventType.CAMPAIGN_CREATED,
        group=CampaignActivity.Group.CAMPAIGN,
        actor=user,
        metadata={'name': campaign.name},
    )
    if activate:
        _set_status(campaign, Status.ACTIVE, actor=user, ended_by='')
    return campaign


def _validate_goal_update(campaign, data):
    changed = {field for field, value in data.items() if getattr(campaign, field) != value}
    if campaign.is_terminal and changed:
        raise ValidationError({'detail': 'Chiến dịch đã kết thúc, không thể chỉnh sửa.'})
    if 'start_date' in changed and campaign.status not in {Status.DRAFT, Status.SCHEDULED}:
        raise ValidationError(
            {'start_date': 'Chỉ đổi được ngày bắt đầu trước khi chiến dịch chạy.'}
        )
    start_date = data.get('start_date', campaign.start_date)
    if campaign.status == Status.SCHEDULED and (
        start_date is None or start_date <= vietnam_today()
    ):
        raise ValidationError(
            {'start_date': 'Chiến dịch đã lên lịch cần ngày bắt đầu sau hôm nay.'}
        )
    target_date = data.get('target_date', campaign.target_date)
    if 'target_date' in changed and target_date is not None:
        from apps.jobs.models import Job

        latest_deadline = Job.objects.filter(campaign=campaign, status=Job.Status.ACTIVE).aggregate(
            latest=Max('deadline')
        )['latest']
        if latest_deadline and target_date < latest_deadline:
            raise ValidationError(
                {
                    'target_date': (
                        'Ngày kết thúc không được trước hạn nhận hồ sơ của tin đang tuyển '
                        f'({latest_deadline:%d/%m/%Y}).'
                    )
                }
            )
    return sorted(changed)


@transaction.atomic
def update_campaign(*, campaign, user, **data):
    recruiter = _recruiter_for(user)
    campaign = RecruitmentCampaign.objects.select_for_update(of=('self',)).get(pk=campaign.pk)
    if campaign.owner_id != recruiter.id:
        raise ValidationError('Bạn không có quyền chỉnh sửa chiến dịch này.')
    _ensure_campaign_not_held(campaign)
    changed_fields = _validate_goal_update(campaign, data)
    if not changed_fields:
        return campaign
    for field, value in data.items():
        setattr(campaign, field, value)
    campaign.save()
    record_campaign_activity(
        campaign=campaign,
        event_type=CampaignActivity.EventType.CAMPAIGN_UPDATED,
        group=CampaignActivity.Group.CAMPAIGN,
        actor=user,
        metadata={'fields': changed_fields},
    )
    return campaign


@transaction.atomic
def change_campaign_status(*, campaign, user, status, confirmation_code=''):
    recruiter = _recruiter_for(user)
    campaign = RecruitmentCampaign.objects.select_for_update(of=('self',)).get(pk=campaign.pk)
    if campaign.owner_id != recruiter.id:
        raise ValidationError('Bạn không có quyền đổi trạng thái chiến dịch này.')
    _ensure_campaign_not_held(campaign)
    if status == campaign.status:
        return campaign
    if status == Status.ACTIVE and campaign.status in {Status.DRAFT, Status.SCHEDULED}:
        raise ValidationError(
            {
                'code': 'CAMPAIGN_LAUNCH_REQUIRED',
                'detail': 'Kích hoạt chiến dịch qua bước Xem lại & Kích hoạt.',
            }
        )
    if status == Status.PAUSED and confirmation_code != campaign.public_id:
        raise ValidationError({'confirmation_code': 'Nhập đúng mã chiến dịch để xác nhận dừng.'})
    if status not in USER_STATUS_TRANSITIONS[campaign.status]:
        raise ValidationError({'status': 'Không thể chuyển sang trạng thái đã chọn.'})
    if status == Status.ACTIVE:
        _ensure_resumable(campaign)
    return _set_status(campaign, status, actor=user, ended_by=RecruitmentCampaign.EndedBy.USER)


def apply_system_campaign_status(*, campaign, status, actor=None, metadata=None):
    """Transition a campaign the caller has already locked (launch flow and scheduler).

    ``actor`` is the recruiter who launched it, or ``None`` for the scheduler.
    """
    _ensure_campaign_not_held(campaign)
    if status not in SYSTEM_STATUS_TRANSITIONS.get(campaign.status, set()):
        raise ValidationError({'status': 'Không thể chuyển sang trạng thái đã chọn.'})
    return _set_status(
        campaign,
        status,
        actor=actor,
        ended_by=RecruitmentCampaign.EndedBy.SYSTEM,
        metadata=metadata,
    )

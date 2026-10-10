from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import CampaignActivity, RecruitmentCampaign
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


@transaction.atomic
def create_campaign(*, user, **data):
    recruiter = _recruiter_for(user)
    data.setdefault('status', RecruitmentCampaign.Status.ACTIVE)
    campaign = RecruitmentCampaign.objects.create(
        owner=recruiter,
        company=recruiter.company,
        **data,
    )
    record_campaign_activity(
        campaign=campaign,
        event_type=CampaignActivity.EventType.CAMPAIGN_CREATED,
        group=CampaignActivity.Group.CAMPAIGN,
        actor=user,
        metadata={'name': campaign.name},
    )
    return campaign


@transaction.atomic
def update_campaign(*, campaign, user, **data):
    recruiter = _recruiter_for(user)
    campaign = RecruitmentCampaign.objects.select_for_update(of=('self',)).get(pk=campaign.pk)
    if campaign.owner_id != recruiter.id:
        raise ValidationError('Bạn không có quyền chỉnh sửa chiến dịch này.')
    _ensure_campaign_not_held(campaign)
    changed_fields = list(data)
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
    if status == RecruitmentCampaign.Status.PAUSED and confirmation_code != campaign.public_id:
        raise ValidationError({'confirmation_code': 'Nhập đúng mã chiến dịch để xác nhận dừng.'})
    allowed_transitions = {
        RecruitmentCampaign.Status.DRAFT: {
            RecruitmentCampaign.Status.ACTIVE,
            RecruitmentCampaign.Status.CANCELLED,
        },
        RecruitmentCampaign.Status.ACTIVE: {
            RecruitmentCampaign.Status.PAUSED,
            RecruitmentCampaign.Status.COMPLETED,
            RecruitmentCampaign.Status.CANCELLED,
        },
        RecruitmentCampaign.Status.PAUSED: {
            RecruitmentCampaign.Status.ACTIVE,
            RecruitmentCampaign.Status.COMPLETED,
            RecruitmentCampaign.Status.CANCELLED,
        },
        RecruitmentCampaign.Status.COMPLETED: set(),
        RecruitmentCampaign.Status.CANCELLED: set(),
    }
    if status == campaign.status:
        return campaign
    if status not in allowed_transitions[campaign.status]:
        raise ValidationError({'status': 'Không thể chuyển sang trạng thái đã chọn.'})
    campaign.status = status
    campaign.save(update_fields=['status', 'updated_at'])
    event_type = (
        CampaignActivity.EventType.CAMPAIGN_PAUSED
        if status == RecruitmentCampaign.Status.PAUSED
        else CampaignActivity.EventType.CAMPAIGN_RESUMED
        if status == RecruitmentCampaign.Status.ACTIVE
        else CampaignActivity.EventType.CAMPAIGN_UPDATED
    )
    record_campaign_activity(
        campaign=campaign,
        event_type=event_type,
        group=CampaignActivity.Group.CAMPAIGN,
        actor=user,
        metadata={'status': status},
    )
    return campaign

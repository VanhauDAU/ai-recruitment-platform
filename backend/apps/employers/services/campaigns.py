from django.db import transaction
from rest_framework.exceptions import ValidationError

from ..models import RecruiterProfile, RecruitmentCampaign


def _recruiter_for(user):
    # A campaign is personal workspace data. It can be created as soon as an
    # employer account exists; company verification is enforced only when the
    # recruiter submits a job for review.
    recruiter, _ = RecruiterProfile.objects.select_related('company').get_or_create(user=user)
    return recruiter


@transaction.atomic
def create_campaign(*, user, **data):
    recruiter = _recruiter_for(user)
    data.setdefault('status', RecruitmentCampaign.Status.ACTIVE)
    return RecruitmentCampaign.objects.create(owner=recruiter, company=recruiter.company, **data)


@transaction.atomic
def update_campaign(*, campaign, user, **data):
    recruiter = _recruiter_for(user)
    if campaign.owner_id != recruiter.id:
        raise ValidationError('Bạn không có quyền chỉnh sửa chiến dịch này.')
    for field, value in data.items():
        setattr(campaign, field, value)
    campaign.save()
    return campaign


@transaction.atomic
def change_campaign_status(*, campaign, user, status):
    recruiter = _recruiter_for(user)
    if campaign.owner_id != recruiter.id:
        raise ValidationError('Bạn không có quyền đổi trạng thái chiến dịch này.')
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
        RecruitmentCampaign.Status.COMPLETED: {RecruitmentCampaign.Status.ACTIVE},
        RecruitmentCampaign.Status.CANCELLED: set(),
    }
    if status == campaign.status:
        return campaign
    if status not in allowed_transitions[campaign.status]:
        raise ValidationError({'status': 'Không thể chuyển sang trạng thái đã chọn.'})
    campaign.status = status
    campaign.save(update_fields=['status', 'updated_at'])
    return campaign

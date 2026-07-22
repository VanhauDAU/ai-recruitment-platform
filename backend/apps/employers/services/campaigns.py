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
    source_need = data.get('source_need')
    if source_need and source_need.recruiter_id != recruiter.id:
        raise ValidationError({'source_need': 'Nhu cầu tuyển dụng không thuộc tài khoản này.'})
    return RecruitmentCampaign.objects.create(owner=recruiter, company=recruiter.company, **data)


@transaction.atomic
def update_campaign(*, campaign, user, **data):
    recruiter = _recruiter_for(user)
    if campaign.owner_id != recruiter.id:
        raise ValidationError('Bạn không có quyền chỉnh sửa chiến dịch này.')
    source_need = data.get('source_need')
    if source_need and source_need.recruiter_id != recruiter.id:
        raise ValidationError({'source_need': 'Nhu cầu tuyển dụng không thuộc tài khoản này.'})
    for field, value in data.items():
        setattr(campaign, field, value)
    campaign.save()
    return campaign


@transaction.atomic
def change_campaign_status(*, campaign, user, status):
    recruiter = _recruiter_for(user)
    if campaign.owner_id != recruiter.id:
        raise ValidationError('Bạn không có quyền đổi trạng thái chiến dịch này.')
    campaign.status = status
    campaign.save(update_fields=['status', 'updated_at'])
    return campaign


@transaction.atomic
def create_campaign_from_need(*, need, user):
    recruiter = _recruiter_for(user)
    if need.recruiter_id != recruiter.id:
        raise ValidationError('Nhu cầu tuyển dụng không thuộc tài khoản này.')
    if RecruitmentCampaign.objects.filter(source_need=need).exists():
        raise ValidationError('Nhu cầu tuyển dụng này đã được chuyển thành chiến dịch.')
    return RecruitmentCampaign.objects.create(
        owner=recruiter,
        company=recruiter.company,
        source_need=need,
        name=f'Tuyển {need.position_category.name}',
        position_category=need.position_category,
        position_level=need.position_level,
        headcount_target=need.headcount,
        target_date=need.target_date,
        is_continuous=need.is_continuous,
        budget_min=need.budget_min,
        budget_max=need.budget_max,
        budget_source=need.budget_source,
        status=RecruitmentCampaign.Status.DRAFT,
    )

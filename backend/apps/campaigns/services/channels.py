"""Recruiter-side channel management: channels, their content, posting and costs."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.employers.models import CampaignActivity, RecruitmentCampaign
from apps.employers.services import record_campaign_activity

from ..models import CampaignChannel, CampaignChannelCost

CONTENT_FIELDS = ('headline', 'body', 'hashtags', 'call_to_action')


def _owned_campaign(campaign, user, *, lock=False):
    queryset = RecruitmentCampaign.objects.filter(pk=campaign.pk, owner__user=user)
    if lock:
        queryset = queryset.select_for_update(of=('self',))
    campaign = queryset.first()
    if campaign is None:
        raise ValidationError('Bạn không có quyền với chiến dịch này.')
    return campaign


def _validate_target(campaign, target, job):
    if target == CampaignChannel.Target.JOB:
        if job is None:
            raise ValidationError({'job': 'Chọn tin mà link sẽ dẫn tới.'})
        if job.campaign_id != campaign.pk:
            raise ValidationError({'job': 'Tin này không thuộc chiến dịch.'})
        return job
    return None


def _clean_content(content):
    content = content or {}
    hashtags = content.get('hashtags') or []
    return {
        'headline': str(content.get('headline', ''))[:200],
        'body': str(content.get('body', ''))[:3000],
        'hashtags': [str(tag)[:40] for tag in hashtags][:10],
        'call_to_action': str(content.get('call_to_action', ''))[:200],
    }


@transaction.atomic
def create_channel(*, campaign, user, kind, label, target=CampaignChannel.Target.LANDING, job=None):
    campaign = _owned_campaign(campaign, user, lock=True)
    if campaign.is_terminal:
        raise ValidationError({'detail': 'Chiến dịch đã kết thúc, không thêm kênh được.'})
    label = label.strip()
    if CampaignChannel.objects.filter(campaign=campaign, label__iexact=label).exists():
        raise ValidationError({'label': 'Chiến dịch đã có kênh cùng tên.'})
    channel = CampaignChannel.objects.create(
        campaign=campaign,
        kind=kind,
        label=label,
        target=target,
        job=_validate_target(campaign, target, job),
        created_by=user,
    )
    record_campaign_activity(
        campaign=campaign,
        event_type=CampaignActivity.EventType.CHANNEL_ADDED,
        group=CampaignActivity.Group.CAMPAIGN,
        actor=user,
        subject_public_id=channel.public_id,
        metadata={'label': channel.label, 'kind': channel.kind},
    )
    return channel


@transaction.atomic
def update_channel(*, channel, user, **data):
    _owned_campaign(channel.campaign, user)
    channel = CampaignChannel.objects.select_for_update().get(pk=channel.pk)
    if 'label' in data:
        label = data['label'].strip()
        clash = CampaignChannel.objects.filter(campaign=channel.campaign, label__iexact=label)
        if clash.exclude(pk=channel.pk).exists():
            raise ValidationError({'label': 'Chiến dịch đã có kênh cùng tên.'})
        channel.label = label
    if 'target' in data or 'job' in data:
        target = data.get('target', channel.target)
        channel.job = _validate_target(channel.campaign, target, data.get('job', channel.job))
        channel.target = target
    if 'content' in data:
        channel.content = _clean_content(data['content'])
        channel.content_source = CampaignChannel.ContentSource.MANUAL
    if 'posted_url' in data:
        channel.posted_url = data['posted_url']
    newly_posted = data.get('posted') is True and channel.posted_at is None
    if 'posted' in data:
        channel.posted_at = (channel.posted_at or timezone.now()) if data['posted'] else None
    channel.save()
    if newly_posted:
        record_campaign_activity(
            campaign=channel.campaign,
            event_type=CampaignActivity.EventType.CHANNEL_POSTED,
            group=CampaignActivity.Group.CAMPAIGN,
            actor=user,
            subject_public_id=channel.public_id,
            metadata={'label': channel.label, 'kind': channel.kind},
        )
    return channel


@transaction.atomic
def delete_channel(*, channel, user):
    """Remove a channel; applications keep their copied ``acquisition_channel``."""
    _owned_campaign(channel.campaign, user)
    channel.delete()


def save_generated_content(channel, content, source):
    channel.content = _clean_content(content)
    channel.content_source = source
    channel.save(update_fields=['content', 'content_source', 'updated_at'])
    return channel


@transaction.atomic
def add_channel_cost(*, channel, user, amount, incurred_on, note=''):
    _owned_campaign(channel.campaign, user)
    return CampaignChannelCost.objects.create(
        channel=channel, amount=amount, incurred_on=incurred_on, note=note.strip(), created_by=user
    )


@transaction.atomic
def delete_channel_cost(*, cost, user):
    _owned_campaign(cost.channel.campaign, user)
    cost.delete()

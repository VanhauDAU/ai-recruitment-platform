"""Scheduled posts on a connected Facebook Page: schedule, publish, retry, clean up.

Celery calls ``dispatch_due_posts`` every minute and ``reconcile_social_posts``
every five minutes (and right after a campaign changes status). Both re-read
the campaign state at run time, so pausing, ending, account locks or a
handover take effect without hooks into those flows.
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.campaigns.models import CampaignActivity, RecruitmentCampaign
from apps.employers.models import EmployerNotification
from apps.employers.services import emit_employer_event

from ..models import CampaignChannel, ScheduledSocialPost, SocialAccountConnection
from .content import render_content
from .social import SocialProviderError, decrypt_token, get_provider
from .social_post_images import clean_post_images, read_post_images
from .tracking import channel_link

Post = ScheduledSocialPost
CampaignStatus = RecruitmentCampaign.Status
RETRY_DELAYS = (
    timedelta(minutes=1),
    timedelta(minutes=5),
    timedelta(minutes=15),
    timedelta(hours=1),
)
MAX_ATTEMPTS = len(RETRY_DELAYS) + 1
STUCK_AFTER = timedelta(minutes=10)


def post_message(channel):
    content = render_content(channel)
    tags = ' '.join(f'#{tag.lstrip("#")}' for tag in content.get('hashtags', []))
    parts = [content.get('headline'), content.get('body'), content.get('call_to_action'), tags]
    return '\n\n'.join(part for part in parts if part)


def _campaign_is_live(campaign):
    return (
        campaign.status == CampaignStatus.ACTIVE
        and not campaign.policy_hold
        and campaign.owner.user.is_active
    )


@transaction.atomic
def schedule_post(*, channel, user, connection, scheduled_for=None, message='', images=()):
    campaign = channel.campaign
    if campaign.owner.user_id != user.pk:
        raise ValidationError('Bạn không có quyền với chiến dịch này.')
    if campaign.is_terminal:
        raise ValidationError({'detail': 'Chiến dịch đã kết thúc, không đăng thêm được.'})
    if channel.kind != CampaignChannel.Kind.FACEBOOK_PAGE:
        raise ValidationError({'detail': 'Chỉ kênh Fanpage Facebook mới đăng tự động được.'})
    if (
        connection.owner_id != campaign.owner_id
        or connection.status != SocialAccountConnection.Status.CONNECTED
    ):
        raise ValidationError(
            {'connection': 'Fanpage chưa kết nối hoặc không thuộc tài khoản này.'}
        )
    now = timezone.now()
    scheduled_for = scheduled_for or now
    if scheduled_for < now - timedelta(minutes=1):
        raise ValidationError({'scheduled_for': 'Chọn thời điểm từ bây giờ trở đi.'})
    message = (message or post_message(channel)).strip()
    if not message:
        raise ValidationError(
            {'message': 'Kênh chưa có nội dung. Soạn nội dung trước khi hẹn đăng.'}
        )
    return Post.objects.create(
        channel=channel,
        connection=connection,
        message=message[:5000],
        images=clean_post_images(campaign, images),
        link=channel_link(channel),
        scheduled_for=scheduled_for,
    )


@transaction.atomic
def cancel_post(*, post, user):
    if post.channel.campaign.owner.user_id != user.pk:
        raise ValidationError('Bạn không có quyền với bài đăng này.')
    if post.status not in Post.OPEN_STATUSES:
        raise ValidationError({'detail': 'Bài đã đăng hoặc đã hủy.'})
    post.status = Post.Status.CANCELLED
    post.save(update_fields=['status', 'updated_at'])
    return post


@transaction.atomic
def reschedule_post(*, post, user, scheduled_for):
    if post.channel.campaign.owner.user_id != user.pk:
        raise ValidationError('Bạn không có quyền với bài đăng này.')
    if post.status not in Post.OPEN_STATUSES:
        raise ValidationError({'detail': 'Chỉ hẹn lại được bài chưa đăng.'})
    if scheduled_for < timezone.now() - timedelta(minutes=1):
        raise ValidationError({'scheduled_for': 'Chọn thời điểm từ bây giờ trở đi.'})
    post.scheduled_for = scheduled_for
    post.status = Post.Status.SCHEDULED
    post.next_attempt_at = None
    post.last_error_code = ''
    post.save(
        update_fields=[
            'scheduled_for',
            'status',
            'next_attempt_at',
            'last_error_code',
            'updated_at',
        ]
    )
    return post


def _notify(campaign, event_type, dedupe_key, message):
    emit_employer_event(
        recipient=campaign.owner.user,
        event_type=event_type,
        dedupe_key=dedupe_key,
        message=message,
        subject_public_id=campaign.public_id,
        metadata={'campaign_public_id': campaign.public_id},
        action_path=f'/tuyendung/app/campaigns/{campaign.public_id}?active_tab=channels',
    )


def _claim(post_id):
    """Lock a due post and move it to ``publishing``, or settle it without calling Meta."""
    with transaction.atomic():
        post = (
            Post.objects.select_for_update(of=('self',))
            .select_related('channel__campaign__owner__user', 'connection')
            .filter(pk=post_id, status=Post.Status.SCHEDULED)
            .first()
        )
        if post is None:
            return None
        campaign = post.channel.campaign
        settle = None
        if campaign.is_terminal:
            settle = (Post.Status.CANCELLED, 'campaign_ended')
        elif campaign.status in {CampaignStatus.DRAFT, CampaignStatus.SCHEDULED}:
            return None  # published as soon as the campaign goes live
        elif not _campaign_is_live(campaign):
            settle = (Post.Status.POSTPONED, 'campaign_paused')
        elif post.connection.owner_id != campaign.owner_id:
            settle = (Post.Status.CANCELLED, 'owner_changed')
        elif post.connection.status != SocialAccountConnection.Status.CONNECTED:
            settle = (Post.Status.FAILED, 'connection_inactive')
        if settle:
            post.status, post.last_error_code = settle
            post.save(update_fields=['status', 'last_error_code', 'updated_at'])
            return None
        post.status = Post.Status.PUBLISHING
        post.attempts += 1
        post.save(update_fields=['status', 'attempts', 'updated_at'])
        return post


def _publish_remote(post):
    provider = get_provider()
    token = decrypt_token(post.connection.token_ciphertext)
    if post.attempts > 1:
        existing = provider.find_recent_post(
            page_id=post.connection.page_id, page_token=token, link=post.link
        )
        if existing:
            return existing
    return provider.publish(
        page_id=post.connection.page_id,
        page_token=token,
        message=post.message,
        link=post.link,
        images=read_post_images(post.images),
    )


@transaction.atomic
def _mark_published(post, published):
    now = timezone.now()
    post.status = Post.Status.PUBLISHED
    post.external_post_id = published.post_id
    post.permalink = published.permalink
    post.published_at = now
    post.last_error_code = ''
    post.save()
    channel = post.channel
    if channel.posted_at is None:
        channel.posted_at = now
        channel.posted_url = channel.posted_url or published.permalink
        channel.save(update_fields=['posted_at', 'posted_url', 'updated_at'])
    CampaignActivity.objects.record(
        campaign=channel.campaign,
        event_type=CampaignActivity.EventType.SOCIAL_POST_PUBLISHED,
        group=CampaignActivity.Group.CAMPAIGN,
        subject_public_id=post.public_id,
        metadata={'label': channel.label, 'page': post.connection.page_name},
    )


@transaction.atomic
def _mark_failed(post, error):
    campaign = post.channel.campaign
    post.last_error_code = error.code
    if error.token_invalid:
        SocialAccountConnection.objects.filter(pk=post.connection_id).update(
            status=SocialAccountConnection.Status.EXPIRED, last_error_code=error.code
        )
        _notify(
            campaign,
            EmployerNotification.EventType.SOCIAL_CONNECTION_EXPIRED,
            f'social-connection-expired:{post.connection.public_id}:{error.code}',
            f'Kết nối Fanpage "{post.connection.page_name}" đã hết hạn. Hãy kết nối lại để tiếp tục đăng.',
        )
    if error.transient and not error.token_invalid and post.attempts < MAX_ATTEMPTS:
        post.status = Post.Status.SCHEDULED
        post.next_attempt_at = timezone.now() + RETRY_DELAYS[post.attempts - 1]
    else:
        post.status = Post.Status.FAILED
        _notify(
            campaign,
            EmployerNotification.EventType.SOCIAL_POST_FAILED,
            f'social-post-failed:{post.public_id}',
            f'Chưa đăng được bài của kênh "{post.channel.label}" lên Fanpage. Mở chiến dịch để hẹn lại.',
        )
    post.save(update_fields=['status', 'next_attempt_at', 'last_error_code', 'updated_at'])


def publish_post(post_id):
    post = _claim(post_id)
    if post is None:
        return None
    try:
        published = _publish_remote(post)
    except SocialProviderError as error:
        _mark_failed(post, error)
        return post.status
    _mark_published(post, published)
    return post.status


def due_post_ids(now=None):
    now = now or timezone.now()
    return list(
        Post.objects.filter(status=Post.Status.SCHEDULED, scheduled_for__lte=now)
        .exclude(next_attempt_at__gt=now)
        .order_by('scheduled_for')
        .values_list('pk', flat=True)[:100]
    )


def _delete_remote(post):
    campaign = post.channel.campaign
    try:
        get_provider().delete(
            post_id=post.external_post_id,
            page_token=decrypt_token(post.connection.token_ciphertext),
        )
    except SocialProviderError as error:
        post.status = Post.Status.DELETE_FAILED
        post.last_error_code = error.code
        post.save(update_fields=['status', 'last_error_code', 'updated_at'])
        _notify(
            campaign,
            EmployerNotification.EventType.SOCIAL_POST_DELETE_FAILED,
            f'social-post-delete-failed:{post.public_id}',
            f'Chưa gỡ được bài kênh "{post.channel.label}" khỏi Fanpage. Hãy tự xóa bài: {post.permalink}',
        )
        return
    post.status = Post.Status.DELETED
    post.deleted_at = timezone.now()
    post.save(update_fields=['status', 'deleted_at', 'updated_at'])
    CampaignActivity.objects.record(
        campaign=campaign,
        event_type=CampaignActivity.EventType.SOCIAL_POST_DELETED,
        group=CampaignActivity.Group.CAMPAIGN,
        subject_public_id=post.public_id,
        metadata={'label': post.channel.label},
    )


def reconcile_social_posts(*, campaign_id=None, now=None):
    """Bring posts in line with their campaign: end, pause, resume, and unstick."""
    now = now or timezone.now()
    posts = Post.objects.select_related('channel__campaign__owner__user', 'connection')
    if campaign_id:
        posts = posts.filter(channel__campaign_id=campaign_id)
    ended = Q(channel__campaign__status__in=RecruitmentCampaign.TERMINAL_STATUSES)
    posts.filter(ended, status__in=Post.OPEN_STATUSES).update(
        status=Post.Status.CANCELLED, last_error_code='campaign_ended'
    )
    for post in posts.filter(ended, status=Post.Status.PUBLISHED):
        _delete_remote(post)
    for post in posts.filter(
        status=Post.Status.SCHEDULED, channel__campaign__status=CampaignStatus.ACTIVE
    ):
        if not _campaign_is_live(post.channel.campaign):
            Post.objects.filter(pk=post.pk, status=Post.Status.SCHEDULED).update(
                status=Post.Status.POSTPONED, last_error_code='campaign_paused'
            )
    posts.filter(
        status=Post.Status.SCHEDULED, channel__campaign__status=CampaignStatus.PAUSED
    ).update(status=Post.Status.POSTPONED, last_error_code='campaign_paused')
    for post in posts.filter(status=Post.Status.POSTPONED, scheduled_for__gt=now):
        if _campaign_is_live(post.channel.campaign):
            Post.objects.filter(pk=post.pk, status=Post.Status.POSTPONED).update(
                status=Post.Status.SCHEDULED, last_error_code=''
            )
    posts.filter(status=Post.Status.PUBLISHING, updated_at__lt=now - STUCK_AFTER).update(
        status=Post.Status.SCHEDULED, next_attempt_at=now
    )

"""Channel post content: AI drafted from public job data, with a fixed-template fallback.

Only what candidates already see publicly (job titles, places, salary text,
benefits, company name) goes into the prompt; never candidate data. The link
is a ``{link}`` placeholder replaced by the channel's tracked URL.
"""

from django.conf import settings
from django.utils import timezone

from apps.ai_core.models import AiInvocation
from apps.ai_core.services import AiGenerationError, generate_structured
from apps.jobs.models import Job
from apps.jobs.services import salary_text, sanitize_source_text

from ..models import CampaignChannel
from .channels import save_generated_content
from .tracking import channel_link

USE_CASE = 'campaign_channel_post'
PROMPT_VERSION = 'campaign-post-v1'
SCHEMA_VERSION = 'campaign-post-v1'
LINK_PLACEHOLDER = '{link}'
DAILY_QUOTA = 20
RESPONSE_SCHEMA = {
    'type': 'object',
    'properties': {
        'headline': {'type': 'string'},
        'body': {'type': 'string'},
        'hashtags': {'type': 'array', 'items': {'type': 'string'}},
        'call_to_action': {'type': 'string'},
    },
    'required': ['headline', 'body', 'hashtags', 'call_to_action'],
}
SYSTEM_INSTRUCTION = (
    'Bạn là chuyên viên tuyển dụng viết bài đăng tuyển ngắn gọn, trung thực bằng tiếng Việt. '
    'Chỉ dùng thông tin được cung cấp, không bịa quyền lợi, mức lương hay yêu cầu. '
    f'Chèn đúng chuỗi {LINK_PLACEHOLDER} ở chỗ đặt link ứng tuyển.'
)
CHANNEL_STYLE = {
    CampaignChannel.Kind.FACEBOOK_PAGE: 'bài Facebook thân thiện, tối đa 1500 ký tự, có vài emoji',
    CampaignChannel.Kind.FACEBOOK_GROUP: 'bài đăng nhóm Facebook ngắn gọn, đi thẳng vào vị trí và quyền lợi',
    CampaignChannel.Kind.LINKEDIN: 'bài LinkedIn giọng chuyên nghiệp, không emoji, tối đa 1300 ký tự',
    CampaignChannel.Kind.ZALO: 'tin nhắn Zalo rất ngắn, tối đa 600 ký tự',
    CampaignChannel.Kind.TIKTOK: 'chú thích video TikTok ngắn, tối đa 300 ký tự',
    CampaignChannel.Kind.EMAIL: 'email mời ứng tuyển, headline là tiêu đề email',
    CampaignChannel.Kind.WEBSITE: 'đoạn giới thiệu cơ hội việc làm cho website công ty',
    CampaignChannel.Kind.QR_OFFLINE: 'nội dung tờ rơi: tiêu đề và tối đa 3 gạch đầu dòng',
    CampaignChannel.Kind.OTHER: 'bài đăng tuyển dụng ngắn gọn',
}


class ContentQuotaExceeded(Exception):
    pass


def _channel_jobs(channel):
    if channel.target == CampaignChannel.Target.JOB and channel.job:
        return [channel.job]
    jobs = Job.objects.filter(campaign=channel.campaign).exclude(status=Job.Status.CLOSED)
    return list(jobs.order_by('-published_at', '-pk')[:5])


def _job_facts(job):
    places = ', '.join(
        location.location.name for location in job.job_locations.select_related('location')[:3]
    )
    deadline = f'; hạn nộp: {job.deadline:%d/%m/%Y}' if job.deadline else ''
    return (
        f'- Vị trí: {job.title}; số lượng: {job.number_of_vacancies}; '
        f'nơi làm việc: {places or "chưa rõ"}; lương: {salary_text(job)}{deadline}\n'
        f'  Quyền lợi: {sanitize_source_text(job.benefits)[:600]}'
    )


def _prompt(channel, jobs):
    company = channel.campaign.company.company_name if channel.campaign.company else ''
    facts = '\n'.join(_job_facts(job) for job in jobs) or '- (chưa có tin)'
    return (
        f'Viết {CHANNEL_STYLE[channel.kind]} cho đợt tuyển dụng "{channel.campaign.name}" '
        f'của {company or "công ty"}.\nCác vị trí:\n{facts}\n'
        'Trả về headline, body, tối đa 5 hashtags không dấu, call_to_action.'
    )


def _validate(result):
    if LINK_PLACEHOLDER not in result.get('body', '') + result.get('call_to_action', ''):
        raise ValueError('missing_link_placeholder')


def template_content(channel, jobs=None):
    """Fixed wording used when AI is off, over quota or fails."""
    jobs = jobs if jobs is not None else _channel_jobs(channel)
    company = channel.campaign.company.company_name if channel.campaign.company else 'Chúng tôi'
    lines = [f'• {job.title} ({job.number_of_vacancies} người, {salary_text(job)})' for job in jobs]
    return {
        'headline': f'{company} đang tuyển dụng: {channel.campaign.name}',
        'body': '\n'.join(
            [
                f'{company} đang tìm đồng đội cho các vị trí:',
                *lines,
                '',
                f'Ứng tuyển tại: {LINK_PLACEHOLDER}',
            ]
        ),
        'hashtags': ['tuyendung', 'vieclam'],
        'call_to_action': f'Ứng tuyển ngay: {LINK_PLACEHOLDER}',
    }


def _quota_left(user):
    start = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
    used = AiInvocation.objects.filter(
        use_case=USE_CASE, correlation_key=f'user:{user.pk}', created_at__gte=start
    ).count()
    return DAILY_QUOTA - used


def render_content(channel):
    """Content with the placeholder replaced by the channel's tracked link."""
    link = channel_link(channel)
    return {
        key: list(value) if key == 'hashtags' else str(value).replace(LINK_PLACEHOLDER, link)
        for key, value in (channel.content or {}).items()
    }


def generate_channel_content(*, channel, user):
    """Draft content for ``channel``; returns ``(channel, fallback_reason)``."""
    jobs = _channel_jobs(channel)
    if not settings.AI_RUNTIME_ENABLED:
        return save_generated_content(
            channel, template_content(channel, jobs), 'template'
        ), 'ai_disabled'
    if _quota_left(user) <= 0:
        raise ContentQuotaExceeded

    try:
        result = generate_structured(
            use_case=USE_CASE,
            prompt=_prompt(channel, jobs),
            response_schema=RESPONSE_SCHEMA,
            prompt_version=PROMPT_VERSION,
            schema_version=SCHEMA_VERSION,
            system_instruction=SYSTEM_INSTRUCTION,
            result_validator=_validate,
            correlation_key=f'user:{user.pk}',
        )
    except AiGenerationError:
        # ai_core normalizes every provider/config failure to this type; the draft
        # then falls back to the template so the recruiter is never left empty-handed.
        return save_generated_content(
            channel, template_content(channel, jobs), 'template'
        ), 'ai_failed'
    return save_generated_content(channel, result.data, 'ai'), ''

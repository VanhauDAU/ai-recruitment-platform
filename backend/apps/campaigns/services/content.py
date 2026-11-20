"""Channel post content: AI drafted from public job data, with a fixed-template fallback.

Only what candidates already see publicly (job titles, places, salary text,
benefits, company name) goes into the prompt; never candidate data. Links are
placeholders replaced by the channel's tracked URLs when rendered: ``{link}`` is
the post's main link, ``{link:<job public_id>}`` the link of one job.
"""

import re

from django.conf import settings
from django.utils import timezone, translation
from django.utils.translation import gettext as _
from django.utils.translation import ngettext

from apps.ai_core.models import AiInvocation
from apps.ai_core.services import AiGenerationError, generate_structured
from apps.jobs.services import salary_text, sanitize_source_text

from ..models import CampaignChannel
from .channels import save_generated_content
from .tracking import channel_link, post_jobs, post_link

USE_CASE = 'campaign_channel_post'
PROMPT_VERSION = 'campaign-post-v2'
SCHEMA_VERSION = 'campaign-post-v1'
LINK_PLACEHOLDER = '{link}'
JOB_LINK_PATTERN = re.compile(r'\{link:([A-Za-z0-9_]+)\}')
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
# Content is written in the language of the request (ADR-0023); the prompt itself
# stays in Vietnamese and only names the output language.
OUTPUT_LANGUAGES = {'vi': 'tiếng Việt', 'en': 'tiếng Anh'}
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


def job_link_placeholder(job):
    return f'{{link:{job.public_id}}}'


def _per_job_links(channel, jobs):
    """Each job gets its own link only when the post links to jobs and has several."""
    return channel.target == CampaignChannel.Target.JOB and len(jobs) > 1


def _job_facts(job, with_link=False):
    places = ', '.join(
        location.location.name for location in job.job_locations.select_related('location')[:3]
    )
    deadline = f'; hạn nộp: {job.deadline:%d/%m/%Y}' if job.deadline else ''
    link = f'; link ứng tuyển riêng: {job_link_placeholder(job)}' if with_link else ''
    return (
        f'- Vị trí: {job.title}; số lượng: {job.number_of_vacancies}; '
        f'nơi làm việc: {places or "chưa rõ"}; lương: {salary_text(job)}{deadline}{link}\n'
        f'  Quyền lợi: {sanitize_source_text(job.benefits)[:600]}'
    )


def output_language():
    """Language code the post is written in: the active request language, else ``vi``."""
    code = (translation.get_language() or settings.LANGUAGE_CODE).split('-')[0]
    return code if code in OUTPUT_LANGUAGES else 'vi'


def system_instruction(language):
    return (
        'Bạn là chuyên viên tuyển dụng viết bài đăng tuyển ngắn gọn, trung thực bằng '
        f'{OUTPUT_LANGUAGES[language]}. '
        'Chỉ dùng thông tin được cung cấp, không bịa quyền lợi, mức lương hay yêu cầu. '
        f'Chèn đúng chuỗi {LINK_PLACEHOLDER} ở chỗ đặt link ứng tuyển; vị trí nào có link '
        'ứng tuyển riêng thì chép nguyên chuỗi link đó ngay sau vị trí ấy.'
    )


def _prompt(channel, jobs, language):
    company = channel.campaign.company.company_name if channel.campaign.company else ''
    per_job = _per_job_links(channel, jobs)
    facts = '\n'.join(_job_facts(job, per_job) for job in jobs) or '- (chưa có tin)'
    return (
        f'Viết {CHANNEL_STYLE[channel.kind]} cho đợt tuyển dụng "{channel.campaign.name}" '
        f'của {company or "công ty"}.\nCác vị trí:\n{facts}\n'
        'Trả về headline, body, tối đa 5 hashtags không dấu, call_to_action'
        f', viết toàn bộ bằng {OUTPUT_LANGUAGES[language]}.'
    )


def _validator(channel, jobs):
    """Every link the post needs must be in the text, or the template is used instead."""
    required = [LINK_PLACEHOLDER]
    if _per_job_links(channel, jobs):
        required += [job_link_placeholder(job) for job in jobs]

    def validate(result):
        text = result.get('body', '') + result.get('call_to_action', '')
        if any(token not in text for token in required):
            raise ValueError('missing_link_placeholder')

    return validate


def template_content(channel, jobs=None):
    """Fixed wording used when AI is off, over quota or fails."""
    jobs = jobs if jobs is not None else post_jobs(channel)
    company = channel.campaign.company.company_name if channel.campaign.company else _('Chúng tôi')
    per_job = _per_job_links(channel, jobs)
    lines = [
        ngettext(
            '• %(title)s (%(count)s người, %(salary)s)',
            '• %(title)s (%(count)s người, %(salary)s)',
            job.number_of_vacancies,
        )
        % {'title': job.title, 'count': job.number_of_vacancies, 'salary': salary_text(job)}
        + (f': {job_link_placeholder(job)}' if per_job else '')
        for job in jobs
    ]
    link = {'link': LINK_PLACEHOLDER}
    return {
        'headline': _('%(company)s đang tuyển dụng: %(campaign)s')
        % {'company': company, 'campaign': channel.campaign.name},
        'body': '\n'.join(
            [
                _('%(company)s đang tìm đồng đội cho các vị trí:') % {'company': company},
                *lines,
                '',
                (_('Xem tất cả vị trí: %(link)s') if per_job else _('Ứng tuyển tại: %(link)s'))
                % link,
            ]
        ),
        'hashtags': [_('tuyendung'), _('vieclam')],
        'call_to_action': _('Ứng tuyển ngay: %(link)s') % link,
    }


def _quota_left(user):
    start = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
    used = AiInvocation.objects.filter(
        use_case=USE_CASE, correlation_key=f'user:{user.pk}', created_at__gte=start
    ).count()
    return DAILY_QUOTA - used


def render_content(channel):
    """Content with link placeholders replaced by the channel's tracked links.

    A job link of a job outside the campaign is harmless: the redirect then opens
    the campaign landing page.
    """
    main = post_link(channel)

    def render(value):
        text = JOB_LINK_PATTERN.sub(lambda match: channel_link(channel, match.group(1)), value)
        return text.replace(LINK_PLACEHOLDER, main)

    return {
        key: list(value) if key == 'hashtags' else render(str(value))
        for key, value in (channel.content or {}).items()
    }


def generate_channel_content(*, channel, user):
    """Draft content for ``channel``'s post; returns ``(channel, fallback_reason)``."""
    jobs = post_jobs(channel)
    if not settings.AI_RUNTIME_ENABLED:
        return save_generated_content(
            channel, template_content(channel, jobs), 'template'
        ), 'ai_disabled'
    if _quota_left(user) <= 0:
        raise ContentQuotaExceeded

    language = output_language()
    try:
        result = generate_structured(
            use_case=USE_CASE,
            prompt=_prompt(channel, jobs, language),
            response_schema=RESPONSE_SCHEMA,
            prompt_version=PROMPT_VERSION,
            schema_version=SCHEMA_VERSION,
            system_instruction=system_instruction(language),
            result_validator=_validator(channel, jobs),
            correlation_key=f'user:{user.pk}',
        )
    except AiGenerationError:
        # ai_core normalizes every provider/config failure to this type; the draft
        # then falls back to the template so the recruiter is never left empty-handed.
        return save_generated_content(
            channel, template_content(channel, jobs), 'template'
        ), 'ai_failed'
    return save_generated_content(channel, result.data, 'ai'), ''

"""Read side of the launch: which jobs can join and what still blocks going live."""

from django.db.models import Q

from apps.campaigns.models import RecruitmentCampaign
from apps.jobs.models import Job
from apps.jobs.services import (
    RESPONSIBILITY_STATEMENT_VERSION,
    employer_job_posting_context,
    job_publishability_errors,
)
from common.vietnam_time import vietnam_today

from ..models import CampaignLaunchJob, CampaignLaunchPlan

LAUNCHABLE_STATUSES = frozenset(
    {RecruitmentCampaign.Status.DRAFT, RecruitmentCampaign.Status.SCHEDULED}
)


def attachable_jobs_queryset(user, campaign):
    """Public jobs of the recruiter that are free to join ``campaign``."""
    return (
        Job.objects.filter(posted_by=user, status=Job.Status.ACTIVE)
        .filter(
            Q(campaign__isnull=True) | Q(campaign__status__in=RecruitmentCampaign.TERMINAL_STATUSES)
        )
        .exclude(campaign=campaign)
        .order_by('-published_at', '-pk')
    )


def launch_entries(campaign):
    """The plan's jobs as ``[(action, job)]``, oldest selection first."""
    return [
        (entry.action, entry.job)
        for entry in CampaignLaunchJob.objects.filter(plan__campaign=campaign)
        .select_related('job', 'job__campaign')
        .order_by('pk')
    ]


def _item(code, label, ok, detail=''):
    return {'code': code, 'label': label, 'ok': bool(ok), 'detail': detail}


def campaign_launch_check(campaign, user, *, entries, scheduled=False, today=None):
    """Checklist the launch must pass; each failing item says what to fix."""
    today = today or vietnam_today()
    items = [
        _item(
            'end_date',
            'Thời gian: ngày kết thúc hoặc tuyển liên tục',
            campaign.is_continuous or (campaign.target_date and campaign.target_date >= today),
            'Chọn ngày kết thúc từ hôm nay trở đi, hoặc bật tuyển liên tục ở bước Thông tin.',
        ),
    ]
    if scheduled:
        items.append(
            _item(
                'start_date',
                'Ngày bắt đầu sau hôm nay',
                campaign.start_date and campaign.start_date > today,
                'Lên lịch cần ngày bắt đầu sau hôm nay.',
            )
        )
    items.append(
        _item(
            'jobs',
            'Có ít nhất một tin tuyển dụng',
            entries,
            'Chọn tin nháp để đăng hoặc tin đang hiển thị để gắn vào chiến dịch.',
        )
    )
    job_problems = []
    for action, job in entries:
        problems = []
        if action == CampaignLaunchJob.Action.PUBLISH:
            if errors := job_publishability_errors(job):
                problems.append('Tin nháp còn thiếu: ' + ', '.join(sorted(errors)))
        elif job.status != Job.Status.ACTIVE:
            problems.append('Tin không còn hiển thị.')
        if (
            not campaign.is_continuous
            and campaign.target_date
            and job.deadline
            and job.deadline > campaign.target_date
        ):
            problems.append('Hạn nhận hồ sơ sau ngày kết thúc chiến dịch.')
        if problems:
            job_problems.append(
                {'public_id': job.public_id, 'title': job.title, 'problems': problems}
            )
    items.append(
        _item(
            'job_content',
            'Tin đủ nội dung và hạn nộp nằm trong chiến dịch',
            not job_problems,
            f'{len(job_problems)} tin cần sửa.' if job_problems else '',
        )
    )
    posting = employer_job_posting_context(user)
    blockers = [*posting['publish_blockers']]
    if not posting['job_workspace_ready']:
        blockers.append({'code': 'workspace', 'label': posting['block_reason']})
    items.append(
        _item(
            'publication',
            'Tài khoản đủ điều kiện đăng tin',
            not blockers,
            '; '.join(blocker['label'] for blocker in blockers),
        )
    )
    new_posts = sum(
        1
        for action, job in entries
        if action == CampaignLaunchJob.Action.PUBLISH and job.submitted_at is None
    )
    items.append(
        _item(
            'quota',
            'Còn lượt đăng tin',
            new_posts <= posting['publish_remain'],
            f'Cần {new_posts} lượt, còn {posting["publish_remain"]} lượt.',
        )
    )
    return {
        'ready': all(item['ok'] for item in items),
        'items': items,
        'job_problems': job_problems,
    }


def _job_row(job, action=''):
    return {
        'public_id': job.public_id,
        'title': job.title,
        'status': job.status,
        'deadline': job.deadline,
        'number_of_vacancies': job.number_of_vacancies,
        'action': action,
    }


def campaign_launch_overview(campaign, user):
    """Everything the wizard's job and review steps need in one response."""
    entries = launch_entries(campaign)
    selected = {job.pk: action for action, job in entries}
    plan = CampaignLaunchPlan.objects.filter(campaign=campaign).first()
    draft_jobs = Job.objects.filter(campaign=campaign, status=Job.Status.DRAFT).order_by('-pk')
    campaign_jobs = Job.objects.filter(campaign=campaign, status=Job.Status.ACTIVE).order_by('-pk')
    attachable = attachable_jobs_queryset(user, campaign)
    launchable = campaign.status in LAUNCHABLE_STATUSES
    start_date = campaign.start_date
    return {
        'can_schedule': bool(start_date and start_date > vietnam_today()),
        'statement_version': RESPONSIBILITY_STATEMENT_VERSION,
        'accepted_statement_version': plan.accepted_statement_version if plan else '',
        'last_error': plan.last_error if plan else {},
        'draft_jobs': [_job_row(job, selected.get(job.pk, '')) for job in draft_jobs],
        'campaign_jobs': [_job_row(job) for job in campaign_jobs],
        'attachable_jobs': [_job_row(job, selected.get(job.pk, '')) for job in attachable],
        'check': campaign_launch_check(campaign, user, entries=entries) if launchable else None,
    }

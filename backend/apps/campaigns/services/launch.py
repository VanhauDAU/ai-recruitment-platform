"""Campaign launch: the single path from draft or scheduled to running."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.campaigns.models import CampaignActivity, RecruitmentCampaign
from apps.employers.services import ensure_recruiter_job_workspace
from apps.jobs.models import Job
from apps.jobs.services import (
    RESPONSIBILITY_STATEMENT_VERSION,
    assign_job_to_campaign,
    publish_job,
)
from common.vietnam_time import vietnam_today

from ..models import CampaignLaunchJob, CampaignLaunchPlan
from .campaigns import apply_system_campaign_status
from .launch_check import (
    LAUNCHABLE_STATUSES,
    attachable_jobs_queryset,
    campaign_launch_check,
    launch_entries,
)

Status = RecruitmentCampaign.Status


def _lock_owned_campaign(campaign, user):
    """Lock in the documented order: user and recruiter, then the campaign."""
    recruiter, _ = ensure_recruiter_job_workspace(user, lock=True)
    campaign = RecruitmentCampaign.objects.select_for_update(of=('self',)).get(pk=campaign.pk)
    if campaign.owner_id != recruiter.pk:
        raise ValidationError('Bạn không có quyền thiết lập chiến dịch này.')
    if campaign.policy_hold:
        raise ValidationError(
            {'code': 'RECRUITMENT_HOLD_ACTIVE', 'detail': 'Chiến dịch đang bị policy hold.'}
        )
    if campaign.status not in LAUNCHABLE_STATUSES:
        raise ValidationError({'status': 'Chiến dịch đã chạy, không còn ở bước thiết lập.'})
    return campaign


def _resolve(queryset, public_ids, label):
    public_ids = list(dict.fromkeys(public_ids))
    jobs = list(queryset.filter(public_id__in=public_ids))
    missing = set(public_ids) - {job.public_id for job in jobs}
    if missing:
        raise ValidationError({label: f'Không dùng được các tin: {", ".join(sorted(missing))}.'})
    return jobs


@transaction.atomic
def save_launch_selection(*, campaign, user, publish_job_ids, attach_job_ids):
    """Replace which jobs the launch publishes or attaches."""
    campaign = _lock_owned_campaign(campaign, user)
    if set(publish_job_ids) & set(attach_job_ids):
        raise ValidationError({'detail': 'Một tin chỉ được chọn một thao tác.'})
    publish_jobs = _resolve(
        Job.objects.filter(posted_by=user, campaign=campaign, status=Job.Status.DRAFT),
        publish_job_ids,
        'publish_job_ids',
    )
    attach_jobs = _resolve(
        attachable_jobs_queryset(user, campaign), attach_job_ids, 'attach_job_ids'
    )
    plan, _ = CampaignLaunchPlan.objects.get_or_create(campaign=campaign)
    plan.jobs.all().delete()
    CampaignLaunchJob.objects.bulk_create(
        [
            *(CampaignLaunchJob(plan=plan, job=job, action='publish') for job in publish_jobs),
            *(CampaignLaunchJob(plan=plan, job=job, action='attach') for job in attach_jobs),
        ]
    )
    return campaign


def _ensure_ready(campaign, user, *, scheduled, today=None):
    check = campaign_launch_check(
        campaign, user, entries=launch_entries(campaign), scheduled=scheduled, today=today
    )
    if not check['ready']:
        raise ValidationError(
            {
                'code': 'CAMPAIGN_NOT_READY',
                'detail': 'Chiến dịch chưa đủ điều kiện kích hoạt.',
                'items': [item for item in check['items'] if not item['ok']],
                'job_problems': check['job_problems'],
            }
        )


def _ensure_statement(version):
    if version != RESPONSIBILITY_STATEMENT_VERSION:
        raise ValidationError(
            {
                'code': 'JOB_RESPONSIBILITY_REQUIRED',
                'detail': 'Xác nhận cam kết chịu trách nhiệm về nội dung tin trước khi kích hoạt.',
            }
        )


def execute_launch(campaign, *, user, actor, accepted_statement_version, today=None):
    """Go live: activate, then publish or attach every planned job, all or nothing.

    ``user`` owns the jobs; ``actor`` is ``None`` when the scheduler runs it.
    The caller holds the campaign lock inside an atomic block.
    """
    today = today or vietnam_today()
    _ensure_statement(accepted_statement_version)
    _ensure_ready(campaign, user, scheduled=False, today=today)
    entries = launch_entries(campaign)
    if campaign.start_date is None or campaign.start_date > today:
        campaign.start_date = today
        campaign.save(update_fields=['start_date', 'updated_at'])
    apply_system_campaign_status(campaign=campaign, status=Status.ACTIVE, actor=actor)
    failures = []
    for action, job in entries:
        try:
            with transaction.atomic():
                if action == CampaignLaunchJob.Action.PUBLISH:
                    publish_job(job, user, accepted_statement_version=accepted_statement_version)
                else:
                    assign_job_to_campaign(job, user, campaign)
        except ValidationError as error:
            failures.append({'public_id': job.public_id, 'title': job.title, 'error': error.detail})
    if failures:
        raise ValidationError(
            {
                'code': 'CAMPAIGN_LAUNCH_FAILED',
                'detail': 'Không kích hoạt được vì có tin chưa đăng hoặc gắn được.',
                'jobs': failures,
            }
        )
    CampaignLaunchJob.objects.filter(plan__campaign=campaign).delete()
    CampaignLaunchPlan.objects.filter(campaign=campaign).update(last_error={}, last_error_at=None)
    return campaign


@transaction.atomic
def launch_campaign(*, campaign, user, mode, accepted_statement_version):
    """Activate now, or schedule activation for the campaign's start date."""
    campaign = _lock_owned_campaign(campaign, user)
    _ensure_statement(accepted_statement_version)
    plan, _ = CampaignLaunchPlan.objects.get_or_create(campaign=campaign)
    plan.accepted_statement_version = accepted_statement_version
    plan.accepted_at = timezone.now()
    plan.accepted_by = user
    plan.save(
        update_fields=['accepted_statement_version', 'accepted_at', 'accepted_by', 'updated_at']
    )
    if mode == 'now':
        return execute_launch(
            campaign,
            user=user,
            actor=user,
            accepted_statement_version=accepted_statement_version,
        )
    _ensure_ready(campaign, user, scheduled=True)
    if campaign.status == Status.SCHEDULED:
        CampaignActivity.objects.record(
            campaign=campaign,
            event_type=CampaignActivity.EventType.CAMPAIGN_SCHEDULED,
            group=CampaignActivity.Group.CAMPAIGN,
            actor=user,
            metadata={'start_date': campaign.start_date.isoformat()},
        )
        return campaign
    return apply_system_campaign_status(
        campaign=campaign,
        status=Status.SCHEDULED,
        actor=user,
        metadata={'start_date': campaign.start_date.isoformat()},
    )

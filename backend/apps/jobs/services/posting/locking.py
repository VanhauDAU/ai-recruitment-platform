"""Row locks and write guards every posting workflow takes before mutating a job.

Campaign rows are always locked before the job row, in primary-key order, so
concurrent workflows touching the same campaign cannot deadlock.
"""

from rest_framework.exceptions import ValidationError

from apps.campaigns.models import RecruitmentCampaign
from apps.employers.services import ensure_recruiter_job_workspace

from ...models import Job


def _locked_recruiter(user):
    recruiter, _ = ensure_recruiter_job_workspace(user, lock=True)
    if recruiter is None or recruiter.company_id is None:
        raise ValidationError('Cập nhật thông tin công ty trước khi đăng tin.')
    return recruiter


def _lock_campaigns(*campaign_ids):
    ids = sorted({campaign_id for campaign_id in campaign_ids if campaign_id is not None})
    return {
        campaign.pk: campaign
        for campaign in RecruitmentCampaign.objects.select_for_update(of=('self',))
        .filter(pk__in=ids)
        .order_by('pk')
    }


def _locked_job(job, *, extra_campaign_ids=()):
    current_campaign_id = Job.objects.filter(pk=job.pk).values_list('campaign_id', flat=True).get()
    locked_campaigns = _lock_campaigns(current_campaign_id, *extra_campaign_ids)
    locked_job = (
        Job.objects.select_for_update(of=('self',)).select_related('campaign').get(pk=job.pk)
    )
    if locked_job.campaign_id != current_campaign_id:
        raise ValidationError(
            {
                'code': 'RECRUITMENT_RESOURCE_CHANGED',
                'detail': 'Chiến dịch của tin vừa thay đổi. Vui lòng tải lại.',
            }
        )
    return locked_job, locked_campaigns


def _locked_requested_campaign(requested_campaign, locked_campaigns):
    if requested_campaign is None:
        return None
    locked_campaign = locked_campaigns.get(requested_campaign.pk)
    if locked_campaign is None:
        raise ValidationError(
            {
                'code': 'RECRUITMENT_RESOURCE_CHANGED',
                'detail': 'Chiến dịch vừa thay đổi. Vui lòng tải lại.',
            }
        )
    return locked_campaign


def _validate_campaign_for_write(campaign, *, recruiter):
    if campaign is None:
        return
    if campaign.owner_id != recruiter.pk:
        raise ValidationError({'campaign': 'Bạn không có quyền dùng chiến dịch này.'})
    if campaign.policy_hold:
        raise ValidationError(
            {
                'code': 'RECRUITMENT_HOLD_ACTIVE',
                'detail': 'Chiến dịch đang bị policy hold.',
            }
        )
    if campaign.is_terminal:
        raise ValidationError({'campaign': 'Chiến dịch này không còn nhận tin tuyển dụng.'})


def _validate_job_for_write(job, *, allow_requested_changes=False):
    if allow_requested_changes and job.editable_for_requested_changes:
        return
    if job.policy_hold or job.moderation_hold:
        raise ValidationError(
            {
                'code': 'RECRUITMENT_HOLD_ACTIVE',
                'detail': 'Tin tuyển dụng đang bị tạm ẩn nên chưa thể thay đổi.',
            }
        )

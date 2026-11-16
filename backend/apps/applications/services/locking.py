"""Row-lock order shared by every recruiter write on an application."""

from http import HTTPStatus

from rest_framework.exceptions import APIException

from apps.employers.models import RecruitmentCampaign
from apps.employers.services import ensure_recruiter_candidate_data_access
from apps.jobs.models import Job

from ..models import Application


class RecruitmentResourceChanged(APIException):
    status_code = HTTPStatus.CONFLICT
    default_code = 'RECRUITMENT_RESOURCE_CHANGED'

    def __init__(self):
        super().__init__(
            detail={
                'code': self.default_code,
                'message': 'Chiến dịch của hồ sơ vừa thay đổi. Vui lòng tải lại.',
                'action': 'reload',
            },
            code=self.default_code,
        )


def lock_recruiter_application(application, *, changed_by):
    """Lock U → R → V → Campaign → Job → Application for recruiter writes."""
    ensure_recruiter_candidate_data_access(changed_by, lock=True)
    relation = (
        Application.objects.filter(pk=application.pk)
        .values(
            'job_id',
            'job__campaign_id',
        )
        .get()
    )
    if relation['job__campaign_id'] is not None:
        try:
            RecruitmentCampaign.objects.select_for_update(of=('self',)).get(
                pk=relation['job__campaign_id']
            )
        except RecruitmentCampaign.DoesNotExist as error:
            raise RecruitmentResourceChanged() from error
    job = Job.objects.select_for_update(of=('self',)).get(pk=relation['job_id'])
    if job.campaign_id != relation['job__campaign_id']:
        raise RecruitmentResourceChanged()
    locked_application = (
        Application.objects.select_for_update(of=('self',))
        .select_related('candidate', 'job', 'job__campaign', 'job__company')
        .get(pk=application.pk)
    )
    # A replaced submission is read-only history: no decision, undo or note.
    if (
        locked_application.job_id != job.pk
        or job.posted_by_id != changed_by.pk
        or not locked_application.is_current
    ):
        raise Application.DoesNotExist
    return locked_application

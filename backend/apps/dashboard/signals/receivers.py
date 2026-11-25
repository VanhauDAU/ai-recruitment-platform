"""Tell open admin sockets which queue changed, whoever changed it.

Every row that feeds a queue of ``build_admin_queue_summary`` (and the admin
invitation badge) is watched here, next to the read model that counts them, so
a candidate filing a report, an employer submitting documents, a worker task or
another admin's decision all refresh the badges and lists without polling.
Queryset ``.update()`` sends no signal: services that drop items that way call
``notify_admin_queue`` themselves.
"""

from django.db.models.signals import post_delete, post_save

from apps.accounts.models import AdminInvitation
from apps.employers.models import (
    CompanyContentChange,
    CompanyDocument,
    CompanyDomainClaim,
    CompanyJoinRequest,
    CompanyReport,
    CompanyUpdateRequest,
    EmployerVerificationCase,
)
from apps.jobs.models import Job, JobReport
from apps.privacy.models import DataSubjectRequest
from apps.realtime.services import notify_admin_queue

QUEUE_BY_MODEL = {
    EmployerVerificationCase: 'recruiter_verification',
    # Re-uploaded documents keep an already reviewed case in the queue.
    CompanyDocument: 'recruiter_verification',
    CompanyDomainClaim: 'domain_verification',
    CompanyUpdateRequest: 'company_updates',
    CompanyJoinRequest: 'company_join_requests',
    CompanyContentChange: 'company_content_changes',
    JobReport: 'job_reports',
    CompanyReport: 'company_reports',
    DataSubjectRequest: 'privacy_requests',
    AdminInvitation: 'admin_invitations',
}
# Jobs are saved for many reasons; only these fields move one in or out of
# the resubmission queue.
JOB_QUEUE_FIELDS = frozenset({'moderation_hold', 'moderation_resubmitted_at'})


def _queue_row_changed(sender, instance, raw=False, **kwargs):
    if not raw:
        notify_admin_queue(QUEUE_BY_MODEL[sender])


def _job_saved(sender, instance, created, raw=False, update_fields=None, **kwargs):
    if raw or created:
        return
    if update_fields is None:
        # A full save cannot tell what changed; only a held job can be queued.
        relevant = instance.moderation_hold != Job.ModerationHold.NONE
    else:
        relevant = not JOB_QUEUE_FIELDS.isdisjoint(update_fields)
    if relevant:
        notify_admin_queue('job_resubmissions')


for _model in QUEUE_BY_MODEL:
    post_save.connect(_queue_row_changed, sender=_model, dispatch_uid=f'admin-queue-save-{_model}')
    post_delete.connect(
        _queue_row_changed, sender=_model, dispatch_uid=f'admin-queue-delete-{_model}'
    )
post_save.connect(_job_saved, sender=Job, dispatch_uid='admin-queue-job-save')

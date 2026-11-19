"""What the employer job form needs to know before the recruiter submits."""

from django.utils.translation import gettext

from apps.employers.services import recruiter_job_publication_state, recruiter_readiness_state

from ...models import Job
from ..lifecycle import job_lifecycle_policy
from .quota import _posting_quota, _quota_exhausted_message, _verified_level_three_job_quota
from .rules import (
    RESPONSIBILITY_STATEMENT_TEXT,
    RESPONSIBILITY_STATEMENT_VERSION,
    job_deadline_policy,
)


def employer_job_posting_context(user):
    recruiter, entitlement, limit = _posting_quota(user)
    _, readiness = recruiter_readiness_state(user)
    count = Job.objects.filter(posted_by=user, submitted_at__isnull=False).count()
    reason = ''
    has_company = recruiter is not None and recruiter.company_id is not None
    # The exact gates publish_job enforces, so the form never promises a post
    # that the submit would refuse.
    publish_blockers = (
        recruiter_job_publication_state(user, company_id=recruiter.company_id)['publish_blockers']
        if has_company
        else []
    )
    if not readiness['job_workspace_ready']:
        workspace_blocker = next(
            (
                blocker
                for blocker in readiness['blockers']
                if 'job_workspace' in blocker['capabilities']
            ),
            None,
        )
        reason = (
            workspace_blocker['message']
            if workspace_blocker
            else gettext('Workspace chưa sẵn sàng.')
        )
    elif not has_company:
        reason = gettext('Cập nhật thông tin công ty trước khi đăng tin.')
    elif publish_blockers:
        reason = publish_blockers[0]['label']
    elif count >= limit:
        reason = _quota_exhausted_message(
            verified_level_three=entitlement['verified_job_quota_eligible'],
            limit=limit,
        )
    return {
        **job_deadline_policy(),
        'lifecycle_policy': job_lifecycle_policy(),
        'responsibility_statement': {
            'version': RESPONSIBILITY_STATEMENT_VERSION,
            'text': RESPONSIBILITY_STATEMENT_TEXT,
        },
        'verification_completed': entitlement['verification_completed'],
        'admin_approved': entitlement['admin_approved'],
        'account_level': entitlement['account_level'],
        'verified_job_quota_eligible': entitlement['verified_job_quota_eligible'],
        'job_workspace_ready': readiness['job_workspace_ready'],
        'candidate_data_access': readiness['candidate_data_access'],
        'dpa_status': readiness['dpa_status'],
        'blockers': readiness['blockers'],
        'published_jobs_count': count,
        'publish_blockers': publish_blockers,
        'publish_limit': limit,
        'publish_remain': max(limit - count, 0),
        'verified_publish_limit': _verified_level_three_job_quota(),
        # Compatibility for clients deployed before the quota contract rename.
        'free_publish_limit': limit,
        'free_publish_remain': max(limit - count, 0),
        'job_postable': bool(
            readiness['job_workspace_ready']
            and has_company
            and not publish_blockers
            and count < limit
        ),
        'block_reason': reason,
    }

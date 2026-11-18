"""Company blocklist: refuse applications from a candidate, silently."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.employers.models import RecruiterProfile
from common.api.exceptions import DomainError

from ..models import Application, CandidateBlock
from .status import change_application_status, reject_blocked_application

BLOCKED_APPLY_MESSAGE = 'Bạn không thể ứng tuyển vào tin này lúc này.'


class CandidateAlreadyBlocked(DomainError):
    def payload(self):
        return {'detail': str(self)}


def is_candidate_blocked(*, company_id, candidate_id):
    return CandidateBlock.objects.filter(
        CandidateBlock.active_q(), company_id=company_id, candidate_id=candidate_id
    ).exists()


def is_candidate_blocked_for_job(job, candidate_id):
    """A block by the job's company refuses the application, whoever made it."""
    return is_candidate_blocked(company_id=job.company_id, candidate_id=candidate_id)


def _can_manage_company_blocks(recruiter, company_id):
    return RecruiterProfile.objects.filter(
        user=recruiter, company_id=company_id, company_role=RecruiterProfile.CompanyRole.OWNER
    ).exists()


@transaction.atomic
def block_candidate(
    application, *, recruiter, reason, note='', duration_days=None, reject_pending=False
):
    """Block the candidate behind ``application`` for every job of its company.

    ``reject_pending`` answers the candidate's unanswered applications to the
    company with "Không phù hợp" through the normal decision flow (so they are
    notified like any other rejection, never told about the block).
    """
    candidate_id = application.candidate_id
    company_id = application.job.company_id
    # An expired block still holds the unique slot: lift it before re-blocking.
    CandidateBlock.objects.filter(
        company_id=company_id, candidate_id=candidate_id, lifted_at__isnull=True
    ).exclude(CandidateBlock.active_q()).update(lifted_at=timezone.now())
    if is_candidate_blocked(company_id=company_id, candidate_id=candidate_id):
        raise CandidateAlreadyBlocked('Ứng viên này đã ở trong danh sách chặn của công ty.')
    block = CandidateBlock.objects.create(
        recruiter=recruiter,
        company_id=company_id,
        candidate_id=candidate_id,
        reason=reason,
        note=note.strip(),
        source_application=application,
        expires_at=timezone.now() + timedelta(days=duration_days) if duration_days else None,
    )
    if reject_pending:
        pending = Application.objects.filter(
            candidate_id=candidate_id,
            job__company_id=company_id,
            is_current=True,
            status__in=Application.UNANSWERED_STATUSES,
        )
        for item in pending.select_related('job'):
            if item.job.posted_by_id == recruiter.pk:
                change_application_status(
                    item, changed_by=recruiter, status=Application.Status.REJECTED
                )
            else:
                reject_blocked_application(item, blocked_by=recruiter)
    return block


def lift_candidate_block(*, recruiter, block_public_id):
    """The recruiter who blocked, or an owner of the company, lifts a block."""
    block = CandidateBlock.objects.filter(public_id=block_public_id, lifted_at__isnull=True).first()
    if block is None or (
        block.recruiter_id != recruiter.pk
        and not _can_manage_company_blocks(recruiter, block.company_id)
    ):
        raise NotFound
    block.lifted_at = timezone.now()
    block.save(update_fields=['lifted_at'])
    return block

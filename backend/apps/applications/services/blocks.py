"""Recruiter blocklist: refuse applications from a candidate, silently."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from ..models import Application, CandidateBlock
from .status import change_application_status

BLOCKED_APPLY_MESSAGE = 'Bạn không thể ứng tuyển vào tin này lúc này.'


class CandidateAlreadyBlocked(ValueError):
    pass


def is_candidate_blocked(*, recruiter_id, candidate_id):
    return CandidateBlock.objects.filter(
        CandidateBlock.active_q(), recruiter_id=recruiter_id, candidate_id=candidate_id
    ).exists()


@transaction.atomic
def block_candidate(
    application, *, recruiter, reason, note='', duration_days=None, reject_pending=False
):
    """Block the candidate behind ``application`` for this recruiter's jobs.

    ``reject_pending`` answers the candidate's unanswered applications with
    "Không phù hợp" through the normal decision flow (so they are notified
    like any other rejection, never told about the block).
    """
    candidate_id = application.candidate_id
    # An expired block still holds the unique slot: lift it before re-blocking.
    CandidateBlock.objects.filter(
        recruiter=recruiter, candidate_id=candidate_id, lifted_at__isnull=True
    ).exclude(CandidateBlock.active_q()).update(lifted_at=timezone.now())
    if is_candidate_blocked(recruiter_id=recruiter.pk, candidate_id=candidate_id):
        raise CandidateAlreadyBlocked('Ứng viên này đã ở trong danh sách đen.')
    block = CandidateBlock.objects.create(
        recruiter=recruiter,
        candidate_id=candidate_id,
        reason=reason,
        note=note.strip(),
        source_application=application,
        expires_at=timezone.now() + timedelta(days=duration_days) if duration_days else None,
    )
    if reject_pending:
        pending = Application.objects.filter(
            candidate_id=candidate_id,
            job__posted_by=recruiter,
            status__in=Application.UNANSWERED_STATUSES,
        )
        for item in pending:
            change_application_status(
                item, changed_by=recruiter, status=Application.Status.REJECTED
            )
    return block


def lift_candidate_block(*, recruiter, block_public_id):
    block = CandidateBlock.objects.filter(
        recruiter=recruiter, public_id=block_public_id, lifted_at__isnull=True
    ).first()
    if block is None:
        raise CandidateBlock.DoesNotExist
    block.lifted_at = timezone.now()
    block.save(update_fields=['lifted_at'])
    return block

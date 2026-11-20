"""Talent pool: keep promising candidates and re-match them to new openings.

Transparency is part of the design: the candidate is told when saved, can
withdraw at any time, and entries lapse after 12 months.
"""

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework.exceptions import NotFound

from apps.candidates.models import CandidateNotification
from apps.candidates.services import emit_candidate_notification
from apps.sitecontent.selectors import retention_days
from common.errors import DomainError

from ..models import TalentPoolEntry, TalentPoolInvitation
from ..models.talent_pool import RETENTION_DAYS

CANDIDATE_POOL_PATH = '/tai-khoan/kho-ung-vien-tiem-nang'
MAX_TAGS = 5


class TalentPoolConflict(DomainError):
    def payload(self):
        return {'detail': str(self)}


def _clean_tags(tags):
    cleaned = []
    for tag in tags or []:
        text = str(tag).strip()[:30]
        if text and text.lower() not in {item.lower() for item in cleaned}:
            cleaned.append(text)
    return cleaned[:MAX_TAGS]


@transaction.atomic
def add_to_talent_pool(application, *, recruiter, note='', tags=()):
    """Save the candidate behind ``application``; tells the candidate once."""
    try:
        with transaction.atomic():
            entry = TalentPoolEntry.objects.create(
                expires_at=timezone.now()
                + timedelta(
                    days=retention_days('talent_pool_retention_days', RETENTION_DAYS, minimum=30)
                ),
                recruiter=recruiter,
                candidate_id=application.candidate_id,
                source_application=application,
                note=note.strip(),
                tags=_clean_tags(tags),
            )
    except IntegrityError as error:
        raise TalentPoolConflict(_('Ứng viên đã có trong kho của bạn.')) from error
    emit_candidate_notification(
        recipient=application.candidate,
        event_type=CandidateNotification.EventType.TALENT_POOL_SAVED,
        dedupe_key=f'talent-pool:{entry.public_id}',
        context={'company_name': application.job.company.company_name},
        action_path=CANDIDATE_POOL_PATH,
    )
    return entry


def update_talent_pool_entry(entry, *, note=None, tags=None):
    if note is not None:
        entry.note = note.strip()
    if tags is not None:
        entry.tags = _clean_tags(tags)
    entry.save(update_fields=['note', 'tags'])
    return entry


def remove_from_talent_pool(entry):
    entry.removed_at = timezone.now()
    entry.save(update_fields=['removed_at'])
    return entry


def withdraw_from_talent_pool(*, candidate, entry_public_id):
    """The candidate's right to leave a recruiter's pool."""
    entry = TalentPoolEntry.objects.filter(
        candidate=candidate,
        public_id=entry_public_id,
        removed_at__isnull=True,
        withdrawn_at__isnull=True,
    ).first()
    if entry is None:
        raise NotFound
    entry.withdrawn_at = timezone.now()
    entry.save(update_fields=['withdrawn_at'])
    return entry


@transaction.atomic
def invite_to_apply(entry, *, job):
    """Invite a pooled candidate to one job, at most once per job."""
    try:
        with transaction.atomic():
            TalentPoolInvitation.objects.create(entry=entry, job=job)
    except IntegrityError as error:
        raise TalentPoolConflict(_('Bạn đã mời ứng viên này ứng tuyển tin này.')) from error
    emit_candidate_notification(
        recipient=entry.candidate,
        event_type=CandidateNotification.EventType.JOB_INVITATION,
        dedupe_key=f'job-invitation:{entry.public_id}:{job.public_id}',
        context={'company_name': job.company.company_name, 'job_title': job.title},
        metadata={'job_public_id': job.public_id},
        action_path=f'/viec-lam/{job.slug}',
    )


def purge_lapsed_talent_pool_entries(*, now=None):
    """Delete expired entries and those closed more than 30 days ago."""
    now = now or timezone.now()
    grace = now - timedelta(days=30)
    deleted, _per_model = TalentPoolEntry.objects.filter(
        Q(expires_at__lte=now) | Q(removed_at__lte=grace) | Q(withdrawn_at__lte=grace)
    ).delete()
    return deleted

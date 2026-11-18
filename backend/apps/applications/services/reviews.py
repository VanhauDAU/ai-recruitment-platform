"""Invite someone without a recruiter account to review one application.

The recruiter shares a revocable, expiring bearer link (only its hash is
stored). The reviewer reads a de-identified CV and leaves one scorecard; the
recruiter is notified and sees the aggregate in the workspace.
"""

import secrets
from copy import deepcopy
from datetime import timedelta
from hashlib import sha256

from django.db import transaction
from django.utils import timezone

from apps.cvs.models import CvAccessLog
from apps.cvs.services import record_application_snapshot_access
from apps.employers.models import EmployerNotification
from apps.employers.services import emit_employer_event

from ..models import ApplicationReview, ApplicationReviewLink

MAX_LINK_DAYS = 30
# Personal details a reviewer does not need to judge competence; hiding them
# (and the photo) reduces bias and limits the spread of candidate data.
MASKED_PERSONAL_FIELDS = ('email', 'phone', 'address', 'website', 'links', 'date_of_birth')
HIDDEN_SECTIONS = {'references'}  # third parties' contact details


class ReviewLinkUnavailable(ValueError):
    """Absent, expired and revoked links are indistinguishable (404)."""


def _token_hash(raw_token):
    return sha256(raw_token.encode('utf-8')).hexdigest()


class ReviewNotShareable(ValueError):
    """This application cannot be sent to an outside reviewer; the message is user-facing."""


@transaction.atomic
def create_review_link(application, *, actor, reviewer_name, message='', expires_in_days=7):
    """Return ``(link, raw_token)``; the raw token is never persisted."""
    # Reviewers only ever see a de-identified CV, and contact details cannot be
    # stripped from a file the candidate uploaded.
    if application.submitted_cv_version.source_file_key:
        raise ReviewNotShareable(
            'CV này là tệp ứng viên tải lên nên không thể ẩn thông tin liên hệ để chia sẻ.'
        )
    raw_token = secrets.token_urlsafe(32)
    link = ApplicationReviewLink.objects.create(
        application=application,
        created_by=actor,
        reviewer_name=reviewer_name.strip(),
        message=message.strip(),
        token_hash=_token_hash(raw_token),
        expires_at=timezone.now() + timedelta(days=min(expires_in_days, MAX_LINK_DAYS)),
    )
    return link, raw_token


def revoke_review_link(application, *, link_public_id):
    link = ApplicationReviewLink.objects.filter(
        application=application, public_id=link_public_id
    ).first()
    if link is None:
        raise ReviewLinkUnavailable
    if link.revoked_at is None:
        link.revoked_at = timezone.now()
        link.save(update_fields=['revoked_at'])
    return link


def _active_link(raw_token, *, lock=False):
    if not raw_token or len(raw_token) > 200:
        raise ReviewLinkUnavailable
    queryset = ApplicationReviewLink.objects.select_related(
        'application__job__company',
        'application__candidate',
        'application__submitted_cv_version__template_version',
    )
    if lock:
        queryset = queryset.select_for_update(of=('self',))
    link = queryset.filter(
        token_hash=_token_hash(raw_token),
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if link is None:
        raise ReviewLinkUnavailable
    return link


@transaction.atomic
def open_review_link(raw_token, *, request):
    """Resolve the link for reading and audit the access."""
    link = _active_link(raw_token, lock=True)
    link.open_count += 1
    link.last_opened_at = timezone.now()
    link.save(update_fields=['open_count', 'last_opened_at'])
    record_application_snapshot_access(
        version=link.application.submitted_cv_version,
        actor=None,
        actor_type=CvAccessLog.ActorType.ANONYMOUS,
        request=request,
        channel=CvAccessLog.AccessChannel.SHARED_LINK,
    )
    return link


def deidentified_content(content_json):
    """CV content for reviewers: no photo, contacts or referees."""
    content = deepcopy(content_json or {})
    personal = content.get('personal_info') or {}
    for field in MASKED_PERSONAL_FIELDS:
        if field in personal:
            personal[field] = [] if isinstance(personal[field], list) else ''
    personal['avatar_asset_id'] = None
    content['sections'] = [
        section
        for section in content.get('sections', [])
        if isinstance(section, dict) and section.get('section_key') not in HIDDEN_SECTIONS
    ]
    return content


@transaction.atomic
def submit_review(raw_token, *, recommendation, rating=None, strengths='', concerns=''):
    """Create or update the link's scorecard; the recruiter is told once."""
    link = _active_link(raw_token, lock=True)
    review, created = ApplicationReview.objects.update_or_create(
        link=link,
        defaults={
            'application': link.application,
            'recommendation': recommendation,
            'rating': rating,
            'strengths': strengths.strip(),
            'concerns': concerns.strip(),
        },
    )
    recruiter = link.application.job.posted_by
    if created and recruiter is not None:
        candidate = link.application.candidate
        emit_employer_event(
            recipient=recruiter,
            event_type=EmployerNotification.EventType.APPLICATION_REVIEW_SUBMITTED,
            dedupe_key=f'application-review:{link.public_id}',
            message=(
                f'{link.reviewer_name} đã gửi đánh giá '
                f'"{ApplicationReview.Recommendation(recommendation).label}" cho hồ sơ '
                f'{candidate.full_name or candidate.email} — {link.application.job.title}.'
            ),
            subject_public_id=link.application.public_id,
            metadata={'application_public_id': link.application.public_id},
            action_path=(
                f'/tuyendung/app/applications?job={link.application.job.public_id}'
                f'&application={link.application.public_id}'
            ),
        )
    return review

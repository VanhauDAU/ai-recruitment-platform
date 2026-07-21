"""Version-bound CV sharing and privacy-minimized access auditing."""

from __future__ import annotations

import secrets
from hashlib import sha256

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ..models import CvAccessLog, CvSharedLink, CvVersion, UserCv
from .audit import record_cv_access


class CvSharePermissionError(ValueError):
    """The actor cannot manage this CV's links."""


class CvShareUnavailableError(ValueError):
    """An absent, expired, revoked, or invalid bearer link must look like 404."""


def token_hash(raw_token: str) -> str:
    return sha256(raw_token.encode('utf-8')).hexdigest()


def _assert_owner(cv: UserCv, actor) -> None:
    if cv.user_id != actor.pk:
        raise CvSharePermissionError('Only the CV owner can manage shared links.')


def _shareable_version(cv: UserCv, version_public_id: str | None) -> CvVersion:
    allowed_kinds = [
        CvVersion.VersionKind.INITIAL,
        CvVersion.VersionKind.MANUAL_SAVE,
        CvVersion.VersionKind.PUBLISHED,
        CvVersion.VersionKind.IMPORTED,
    ]
    versions = CvVersion.objects.select_for_update().filter(cv=cv, version_kind__in=allowed_kinds)
    if version_public_id:
        version = versions.filter(public_id=version_public_id).first()
    else:
        version_id = cv.published_version_id or cv.latest_version_id
        version = versions.filter(pk=version_id).first() if version_id else None
    if version is None:
        raise CvSharePermissionError('Select an immutable CV version owned by this CV.')
    return version


@transaction.atomic
def create_shared_link(
    *, cv: UserCv, actor, version_public_id: str | None = None, expires_at=None
) -> tuple[CvSharedLink, str]:
    """Create a bearer token once; persist only its SHA-256 hash."""
    # Lock only the aggregate row. ``latest_version`` and ``published_version``
    # are nullable FKs, so joining them under PostgreSQL FOR UPDATE is invalid.
    cv = UserCv.objects.select_for_update(of=('self',)).get(pk=cv.pk)
    _assert_owner(cv, actor)
    if not actor.email_verified:
        raise CvSharePermissionError('Verify your email before sharing a CV.')
    if expires_at is not None and expires_at <= timezone.now():
        raise CvSharePermissionError('Shared-link expiry must be in the future.')
    version = _shareable_version(cv, version_public_id)
    raw_token = secrets.token_urlsafe(32)
    link = CvSharedLink.objects.create(
        cv=cv,
        version=version,
        token_hash=token_hash(raw_token),
        expires_at=expires_at,
        created_by=actor,
    )
    return link, raw_token


@transaction.atomic
def revoke_shared_link(*, cv: UserCv, actor, link_public_id: str) -> CvSharedLink:
    """Revoke idempotently while retaining the row for auditability."""
    cv = UserCv.objects.select_for_update().get(pk=cv.pk)
    _assert_owner(cv, actor)
    try:
        link = CvSharedLink.objects.select_for_update().get(cv=cv, public_id=link_public_id)
    except CvSharedLink.DoesNotExist as error:
        raise CvShareUnavailableError('Shared link does not exist.') from error
    if link.revoked_at is None:
        link.revoked_at = timezone.now()
        link.save(update_fields=['revoked_at'])
    return link


def owner_view_version(*, cv: UserCv, actor, request) -> CvVersion:
    """Return only an immutable owner-visible version and audit the access."""
    _assert_owner(cv, actor)
    version_id = cv.published_version_id or cv.latest_version_id
    try:
        version = CvVersion.objects.select_related('template_version').get(pk=version_id, cv=cv)
    except CvVersion.DoesNotExist as error:
        raise CvShareUnavailableError('CV has no immutable version.') from error
    record_cv_access(
        cv=cv,
        version=version,
        actor_type=CvAccessLog.ActorType.OWNER,
        access_channel=CvAccessLog.AccessChannel.OWNER_VIEW,
        request=request,
        actor_user=actor,
    )
    return version


@transaction.atomic
def resolve_shared_link(*, raw_token: str, request) -> tuple[CvSharedLink, CvVersion]:
    """Resolve a valid bearer token and audit it without retaining raw metadata."""
    if not raw_token or len(raw_token) > 200:
        raise CvShareUnavailableError('Shared link is invalid.')
    now = timezone.now()
    link = (
        CvSharedLink.objects.select_for_update(of=('self',))
        .filter(
            token_hash=token_hash(raw_token),
            cv__is_deleted=False,
            revoked_at__isnull=True,
        )
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .first()
    )
    if link is None:
        raise CvShareUnavailableError('Shared link is invalid, expired, or revoked.')
    # Load nullable version/template relations after the link row itself is
    # locked; PostgreSQL cannot lock the nullable side of an outer join.
    link = CvSharedLink.objects.select_related('cv', 'version__template_version').get(pk=link.pk)
    CvSharedLink.objects.filter(pk=link.pk).update(last_accessed_at=now)
    link.last_accessed_at = now
    record_cv_access(
        cv=link.cv,
        version=link.version,
        actor_type=CvAccessLog.ActorType.ANONYMOUS,
        access_channel=CvAccessLog.AccessChannel.SHARED_LINK,
        request=request,
        shared_link=link,
    )
    return link, link.version

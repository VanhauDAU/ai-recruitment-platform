"""Privacy-minimized audit writes shared by CV access workflows."""

from __future__ import annotations

import hmac
from hashlib import sha256

from django.conf import settings

from common.http.client_ip import client_ip

from ..models import CvAccessLog


def _metadata_hash(value: str) -> str:
    if not value:
        return ''
    return hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        value.encode('utf-8'),
        sha256,
    ).hexdigest()


def request_access_metadata(request) -> tuple[str, str]:
    """Hash request metadata without retaining raw IP, UA, token, or CV data.

    The IP comes from ``client_ip`` so a client cannot plant an arbitrary
    ``X-Forwarded-For`` value into the audit trail of a shared CV.
    """
    return (
        _metadata_hash(client_ip(request) or ''),
        _metadata_hash(request.META.get('HTTP_USER_AGENT', '')),
    )


def record_cv_access(
    *,
    cv,
    version,
    actor_type,
    access_channel,
    request,
    actor_user=None,
    shared_link=None,
    reason='',
) -> CvAccessLog:
    """Persist only actor/channel/version metadata (and an admin's stated reason)."""
    ip_hash, user_agent_hash = request_access_metadata(request)
    return CvAccessLog.objects.create(
        cv=cv,
        version=version,
        actor_user=actor_user,
        actor_type=actor_type,
        access_channel=access_channel,
        shared_link=shared_link,
        ip_hash=ip_hash,
        user_agent_hash=user_agent_hash,
        reason=reason,
    )


def record_application_snapshot_access(
    *, version, actor, request, channel, actor_type=CvAccessLog.ActorType.RECRUITER
) -> CvAccessLog:
    """Read/download of an application snapshot (``cv`` stays NULL so the record
    outlives the candidate deleting the library CV). Reviewers invited through a
    review link are logged as anonymous on the shared-link channel."""
    return record_cv_access(
        cv=None,
        version=version,
        actor_type=actor_type,
        access_channel=channel,
        request=request,
        actor_user=actor,
    )

"""Privacy-minimized audit writes shared by CV access workflows."""

from __future__ import annotations

from hashlib import sha256
import hmac

from django.conf import settings

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
    """Hash request metadata without retaining raw IP, UA, token, or CV data."""
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
    ip_address = forwarded_for.split(',', 1)[0].strip() if forwarded_for else request.META.get('REMOTE_ADDR', '')
    return _metadata_hash(ip_address), _metadata_hash(request.META.get('HTTP_USER_AGENT', ''))


def record_cv_access(*, cv, version, actor_type, access_channel, request, actor_user=None, shared_link=None) -> CvAccessLog:
    """Persist only actor/channel/version metadata for a sensitive CV action."""
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
    )

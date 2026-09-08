"""Versioned employer DPA acceptance workflow."""

import hmac
from datetime import timedelta
from hashlib import sha256

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import AuthSession

from ..models import DpaStatus, EmployerDpaAcceptance
from ..models.readiness import current_dpa_status
from .compliance import (
    apply_dpa_hold,
    lock_or_create_verification_identity,
    lock_verification_identity,
    release_dpa_holds,
)
from .profiles import get_or_create_recruiter
from .verification import reconcile_recruiter_verification


class DpaPolicyError(ValueError):
    code = 'DPA_POLICY_INVALID'


class DpaPolicyUnavailable(DpaPolicyError):
    code = 'DPA_POLICY_UNAVAILABLE'


class DpaPolicyChanged(DpaPolicyError):
    code = 'DPA_POLICY_CHANGED'


class DpaGraceConflict(DpaPolicyError):
    code = 'DPA_GRACE_CONFLICT'


def current_dpa_policy():
    version = settings.EMPLOYER_DPA_POLICY_VERSION
    document_sha256 = settings.EMPLOYER_DPA_DOCUMENT_SHA256
    document_url = settings.EMPLOYER_DPA_DOCUMENT_URL
    if (
        not version
        or len(document_sha256) != 64
        or any(character not in '0123456789abcdef' for character in document_sha256)
        or not document_url
    ):
        raise DpaPolicyUnavailable('DPA hiện hành chưa được cấu hình đầy đủ.')
    return {
        'policy_version': version,
        'document_sha256': document_sha256,
        'document_url': document_url,
    }


def _metadata_hash(value):
    if not value:
        return ''
    return hmac.new(
        settings.SECRET_KEY.encode(),
        value.encode(),
        sha256,
    ).hexdigest()


@transaction.atomic
def start_recruiter_dpa_grace(recruiter, *, rollout_id, started_at=None):
    """Start the approved 30-day grace without fabricating acceptance proof."""

    rollout_id = rollout_id.strip()
    if not rollout_id or len(rollout_id) > 64:
        raise DpaGraceConflict('rollout_id phải có 1–64 ký tự.')
    current_dpa_policy()
    scope = lock_or_create_verification_identity(recruiter)
    recruiter = scope.recruiter
    status = current_dpa_status(recruiter)
    if status not in {DpaStatus.LEGACY_UNVERSIONED, DpaStatus.OUTDATED, DpaStatus.GRACE}:
        return recruiter, False
    if recruiter.dpa_grace_expires_at:
        if recruiter.dpa_grace_rollout_id != rollout_id:
            raise DpaGraceConflict('Recruiter đã thuộc một DPA grace rollout khác.')
        return recruiter, False
    started_at = started_at or timezone.now()
    recruiter.dpa_grace_started_at = started_at
    recruiter.dpa_grace_expires_at = started_at + timedelta(days=settings.EMPLOYER_DPA_GRACE_DAYS)
    recruiter.dpa_grace_rollout_id = rollout_id
    recruiter.save(
        update_fields=[
            'dpa_grace_started_at',
            'dpa_grace_expires_at',
            'dpa_grace_rollout_id',
            'updated_at',
        ]
    )
    return recruiter, True


@transaction.atomic
def apply_expired_recruiter_dpa_hold(recruiter, *, actor=None):
    """Apply/link the DPA hold after grace expiry using canonical lock order."""

    base_scope = lock_or_create_verification_identity(recruiter)
    scope = lock_verification_identity(base_scope.case, include_resources=True)
    recruiter = scope.recruiter
    if (
        not recruiter.dpa_grace_expires_at
        or recruiter.dpa_grace_expires_at > timezone.now()
        or current_dpa_status(recruiter) != DpaStatus.HOLD
    ):
        return None, False
    return apply_dpa_hold(
        scope,
        rollout_id=recruiter.dpa_grace_rollout_id,
        actor=actor,
    )


@transaction.atomic
def accept_recruiter_dpa(
    user,
    *,
    expected_policy_version,
    expected_document_sha256,
    ip_address=None,
    auth_session_id=None,
    user_agent='',
):
    """Append exact DPA evidence; stale browser documents fail with 409 upstream."""
    policy = current_dpa_policy()
    if (
        expected_policy_version != policy['policy_version']
        or expected_document_sha256 != policy['document_sha256']
    ):
        raise DpaPolicyChanged('DPA đã thay đổi. Vui lòng tải lại và đọc phiên bản mới nhất.')

    recruiter = get_or_create_recruiter(user)
    base_scope = lock_or_create_verification_identity(recruiter)
    scope = lock_verification_identity(base_scope.case, include_resources=True)
    recruiter = scope.recruiter
    verified_session_id = None
    if auth_session_id:
        verified_session_id = (
            AuthSession.objects.filter(
                id=auth_session_id,
                user=user,
                revoked_at__isnull=True,
            )
            .values_list('id', flat=True)
            .first()
        )
    acceptance, created = EmployerDpaAcceptance.objects.get_or_create(
        recruiter=recruiter,
        policy_version=policy['policy_version'],
        document_sha256=policy['document_sha256'],
        defaults={
            'document_url': policy['document_url'],
            'ip_address': ip_address,
            'auth_session_id': verified_session_id,
            'user_agent_hash': _metadata_hash(user_agent[:400]),
        },
    )
    pointer_changed = (
        recruiter.dpa_accepted_at != acceptance.accepted_at
        or recruiter.dpa_policy_version != acceptance.policy_version
        or recruiter.dpa_document_sha256 != acceptance.document_sha256
        or recruiter.dpa_grace_started_at is not None
        or recruiter.dpa_grace_expires_at is not None
        or bool(recruiter.dpa_grace_rollout_id)
    )
    if pointer_changed:
        recruiter.dpa_accepted_at = acceptance.accepted_at
        recruiter.dpa_policy_version = acceptance.policy_version
        recruiter.dpa_document_sha256 = acceptance.document_sha256
        recruiter.dpa_grace_started_at = None
        recruiter.dpa_grace_expires_at = None
        recruiter.dpa_grace_rollout_id = ''
        recruiter.save(
            update_fields=[
                'dpa_accepted_at',
                'dpa_policy_version',
                'dpa_document_sha256',
                'dpa_grace_started_at',
                'dpa_grace_expires_at',
                'dpa_grace_rollout_id',
                'updated_at',
            ]
        )
    release_dpa_holds(
        scope,
        actor=user,
        reason=f'DPA re-consent {acceptance.policy_version}',
    )
    if created:
        reconcile_recruiter_verification(recruiter, source='dpa_accepted')
    return recruiter

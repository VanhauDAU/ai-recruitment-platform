"""Versioned employer DPA acceptance workflow."""

import hmac
from hashlib import sha256

from django.conf import settings
from django.db import transaction

from apps.accounts.models import AuthSession

from ..models import EmployerDpaAcceptance, RecruiterProfile
from .profiles import get_or_create_recruiter
from .verification import reconcile_recruiter_verification


class DpaPolicyError(ValueError):
    code = 'DPA_POLICY_INVALID'


class DpaPolicyUnavailable(DpaPolicyError):
    code = 'DPA_POLICY_UNAVAILABLE'


class DpaPolicyChanged(DpaPolicyError):
    code = 'DPA_POLICY_CHANGED'


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
    recruiter = RecruiterProfile.objects.select_for_update().get(pk=recruiter.pk)
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
    )
    if pointer_changed:
        recruiter.dpa_accepted_at = acceptance.accepted_at
        recruiter.dpa_policy_version = acceptance.policy_version
        recruiter.dpa_document_sha256 = acceptance.document_sha256
        recruiter.save(
            update_fields=[
                'dpa_accepted_at',
                'dpa_policy_version',
                'dpa_document_sha256',
                'updated_at',
            ]
        )
    if created:
        reconcile_recruiter_verification(recruiter, source='dpa_accepted')
    return recruiter

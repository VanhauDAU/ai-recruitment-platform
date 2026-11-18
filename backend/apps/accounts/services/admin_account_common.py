"""Guards and audit helpers shared by the administrator account use cases.

Every admin write on an account validates its reason the same way, refuses
non-superusers on admin accounts, and checks that the impact token was issued
against the current audit revision; keeping that in one place keeps the
confirm flows consistent.
"""

from django.core.exceptions import ValidationError
from django.db.models import Max

from apps.accounts.domain.impact_token_rules import StaleImpactToken
from apps.accounts.services.exceptions import AdminPermissionDenied

from ..models import (
    AdminAccessAuditLog,
    AuthEmailJob,
)


def admin_actor_kwargs(actor):
    return {'actor': actor, 'source': 'api', 'actor_identifier': actor.email}


def clean_admin_reason(reason):
    cleaned = (reason or '').strip()
    if not cleaned:
        raise ValidationError({'reason': 'Vui lòng nhập lý do thao tác.'})
    if len(cleaned) > 500:
        raise ValidationError({'reason': 'Lý do không được vượt quá 500 ký tự.'})
    return cleaned


def clean_verification_evidence(verification_evidence):
    cleaned = (verification_evidence or '').strip()
    if len(cleaned) < 20:
        raise ValidationError(
            {
                'verification_evidence': (
                    'Bằng chứng xác minh cần mô tả cụ thể và có ít nhất 20 ký tự.'
                )
            }
        )
    if len(cleaned) > 500:
        raise ValidationError(
            {'verification_evidence': 'Bằng chứng xác minh không được vượt quá 500 ký tự.'}
        )
    return cleaned


def current_audit_revision():
    return AdminAccessAuditLog.objects.aggregate(value=Max('id'))['value'] or 0


def assert_audit_revision(claims):
    if current_audit_revision() != claims['revision']:
        raise StaleImpactToken('Dữ liệu tài khoản đã thay đổi.')


def ensure_account_write_allowed(actor, user):
    if user.is_admin_role and not actor.is_superuser:
        raise AdminPermissionDenied('Chỉ superuser được thay đổi tài khoản quản trị.')


def cancel_pending_auth_email_jobs(jobs):
    cancelled = 0
    for job in jobs:
        if job.status != AuthEmailJob.Status.PENDING:
            continue
        job.status = AuthEmailJob.Status.CANCELLED
        job.save(update_fields=['status', 'updated_at'])
        cancelled += 1
    return cancelled

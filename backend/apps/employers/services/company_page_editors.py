"""Delegating company page editing from the owner to verified members."""

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from ..models import CompanyPageEditorGrant, CompanyPageEvent, EmployerNotification
from ..models.page_access import is_company_owner, is_page_eligible, page_access_recruiters
from .notifications import emit_employer_event

REVOKED_BY_OWNER = 'owner_revoked'
REVOKED_BY_UNLINK = 'company_unlinked'


def _record(grant, *, actor, event_type, **extra):
    CompanyPageEvent.objects.create(
        company_id=grant.company_id,
        actor=actor,
        event_type=event_type,
        payload={
            'grant_public_id': grant.public_id,
            'recruiter_public_id': grant.recruiter.public_id,
            **extra,
        },
    )


def _notify(grant, *, actor, event_type, message):
    emit_employer_event(
        recipient=grant.recruiter.user,
        actor=actor,
        event_type=event_type,
        dedupe_key=f'company-page-grant:{grant.public_id}:{event_type}',
        message=message,
        subject_public_id=grant.company.public_id,
        metadata={'company_public_id': grant.company.public_id},
    )


@transaction.atomic
def grant_company_page_editor(*, company, actor, member_id):
    """Let one verified member edit the company page."""
    member = (
        page_access_recruiters(company.pk).select_related('user').filter(public_id=member_id)
    ).first()
    if member is None:
        raise NotFound('Không tìm thấy thành viên của công ty.')
    if is_company_owner(member):
        raise ValidationError(
            {
                'code': 'EDITOR_IS_OWNER',
                'detail': 'Người tạo hồ sơ công ty không cần được cấp quyền biên tập.',
            }
        )
    if not is_page_eligible(member):
        raise ValidationError(
            {
                'code': 'EDITOR_NOT_VERIFIED',
                'detail': 'Thành viên cần có xác thực nhà tuyển dụng còn hiệu lực để được cấp quyền.',
            }
        )
    try:
        # The partial unique index, not a prior read, settles parallel grants.
        with transaction.atomic():
            grant = CompanyPageEditorGrant.objects.create(
                company=company,
                recruiter=member,
                granted_by=actor,
            )
    except IntegrityError as error:
        raise ValidationError(
            {
                'code': 'EDITOR_ALREADY_GRANTED',
                'detail': 'Thành viên này đã có quyền biên tập trang công ty.',
            }
        ) from error
    _record(grant, actor=actor, event_type=CompanyPageEvent.EventType.EDITOR_GRANTED)
    _notify(
        grant,
        actor=actor,
        event_type=EmployerNotification.EventType.COMPANY_PAGE_EDITOR_GRANTED,
        message='Bạn có thể chỉnh bố cục và nội dung trang công ty.',
    )
    return grant


def _close(grant, *, actor, reason):
    grant.revoked_at = timezone.now()
    grant.revoked_by = actor
    grant.revoke_reason = reason
    grant.save(update_fields=['revoked_at', 'revoked_by', 'revoke_reason'])
    _record(
        grant,
        actor=actor,
        event_type=CompanyPageEvent.EventType.EDITOR_REVOKED,
        reason=reason,
    )


def _active_grants():
    return (
        CompanyPageEditorGrant.objects.select_for_update(of=('self',))
        .select_related('company', 'recruiter__user')
        .filter(revoked_at__isnull=True)
    )


@transaction.atomic
def revoke_company_page_editor(*, company, actor, grant_public_id):
    """Withdraw an active grant; returns the grant with its member loaded."""
    grant = _active_grants().filter(company=company, public_id=grant_public_id).first()
    if grant is None:
        raise NotFound('Không tìm thấy quyền biên tập đang có hiệu lực.')
    _close(grant, actor=actor, reason=REVOKED_BY_OWNER)
    _notify(
        grant,
        actor=actor,
        event_type=EmployerNotification.EventType.COMPANY_PAGE_EDITOR_REVOKED,
        message='Người tạo hồ sơ công ty đã thu hồi quyền biên tập trang công ty của bạn.',
    )
    return grant


def revoke_page_editor_grants_on_unlink(recruiter, *, actor):
    """Close the grant of a recruiter who is leaving the company.

    Runs inside the unlink transaction, which sends its own notification.
    """
    for grant in _active_grants().filter(recruiter=recruiter):
        _close(grant, actor=actor, reason=REVOKED_BY_UNLINK)

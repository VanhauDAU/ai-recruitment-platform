"""Submitting and resolving reports about a public company page."""

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.services import record_admin_action

from ..models import Company, CompanyReport, CompanyReportResolutionEvent
from .company_page import set_company_page_policy_hold

RESOLVED_STATUSES = {CompanyReport.Status.UPHELD, CompanyReport.Status.DISMISSED}


def submit_company_report(*, company, reporter, reason, section_key='', detail=''):
    """File a report about ``company``.

    The partial unique index allows one pending report per reporter and
    company; catching its IntegrityError instead of checking first leaves no
    gap for parallel submissions.
    """
    try:
        with transaction.atomic():
            return CompanyReport.objects.create(
                company=company,
                reporter=reporter,
                reason=reason,
                section_key=section_key,
                detail=detail.strip(),
            )
    except IntegrityError as error:
        raise ValidationError(
            {'detail': 'Bạn đã có một báo cáo đang chờ xử lý cho công ty này.'}
        ) from error


def _lock_report(report):
    return CompanyReport.objects.select_for_update().get(pk=report.pk)


def _record_transition(report, *, to_status, note, actor):
    """Append the history event, then move the report to ``to_status``."""
    CompanyReportResolutionEvent.objects.create(
        report=report,
        from_status=report.status,
        to_status=to_status,
        note=note,
        actor=actor,
    )
    resolved = to_status in RESOLVED_STATUSES
    report.status = to_status
    report.resolution_note = note if resolved else ''
    report.resolved_at = timezone.now() if resolved else None
    report.resolved_by = actor if resolved else None
    report.save(
        update_fields=['status', 'resolution_note', 'resolved_at', 'resolved_by', 'updated_at']
    )


def _hold_page_unless_held(company_id, *, actor, reason):
    # The row lock turns "already held" into a silent skip even when another
    # moderator holds the page at the same moment.
    company = (
        Company.objects.select_for_update()
        .only('public_id', 'content_policy_hold')
        .get(pk=company_id)
    )
    if company.content_policy_hold:
        return False
    set_company_page_policy_hold(company, actor=actor, hold=True, reason=reason)
    return True


@transaction.atomic
def resolve_company_report(*, report, status, actor, note, apply_hold=False):
    """Conclude a pending report; an upheld one may hide the page with it."""
    if status not in RESOLVED_STATUSES:
        raise ValidationError({'status': 'Trạng thái kết luận không hợp lệ.'})
    if apply_hold and status != CompanyReport.Status.UPHELD:
        raise ValidationError({'apply_hold': 'Chỉ tạm ẩn trang khi xác nhận vi phạm.'})
    locked = _lock_report(report)
    if locked.status != CompanyReport.Status.PENDING:
        raise ValidationError({'detail': 'Báo cáo này đã được xử lý.'})

    _record_transition(locked, to_status=status, note=note, actor=actor)
    hold_applied = apply_hold and _hold_page_unless_held(
        locked.company_id, actor=actor, reason=note
    )
    record_admin_action(
        actor=actor,
        action='resolve_company_report',
        target_type='company_report',
        target_public_id=locked.public_id,
        payload={'status': status, 'note': note, 'hold_applied': hold_applied},
    )


@transaction.atomic
def reverse_company_report(*, report, actor, note):
    """Reopen a resolved report.

    A hold applied with the resolution stays: restoring a public page is a
    separate decision with its own permission and audit trail.
    """
    locked = _lock_report(report)
    from_status = locked.status
    if from_status not in RESOLVED_STATUSES:
        raise ValidationError({'detail': 'Báo cáo này chưa có kết luận để mở lại.'})

    try:
        with transaction.atomic():
            _record_transition(
                locked, to_status=CompanyReport.Status.PENDING, note=note, actor=actor
            )
    except IntegrityError as error:
        # The reporter filed a new report after this one was resolved.
        raise ValidationError(
            {'detail': 'Người báo cáo đã có một báo cáo khác đang chờ xử lý cho công ty này.'}
        ) from error
    record_admin_action(
        actor=actor,
        action='reverse_company_report',
        target_type='company_report',
        target_public_id=locked.public_id,
        payload={'from_status': from_status, 'note': note},
    )

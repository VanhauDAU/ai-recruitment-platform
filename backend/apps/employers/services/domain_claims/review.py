"""Administrator decisions on a domain claim, previewed with an impact token."""

from calendar import monthrange

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.accounts.api.permissions import require_admin
from apps.accounts.services import (
    InvalidImpactToken,
    StaleImpactToken,
    create_impact_token,
    decode_impact_token,
    record_admin_action,
)

from ...models import (
    CompanyDomainClaim,
    CompanyDomainClaimEvent,
    EmployerVerificationCase,
)
from ..verification import verification_checks
from .claims import assert_no_active_conflict, record_claim_event
from .domains import DomainClaimError, verified_email_domain


def _add_months(value, count):
    month_index = value.month - 1 + count
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def domain_claim_admin_impact(claim, *, actor, action, reason):
    """Preview a manual decision; the reason may still be blank (checked on confirm)."""
    reason = (reason or '').strip()
    if action not in {'approve_manual', 'reject_manual', 'revoke'}:
        raise DomainClaimError('invalid_action', _('Thao tác không hợp lệ.'))
    require_admin(actor)
    payload = {'action': action, 'reason': reason, 'status': claim.status, 'domain': claim.domain}
    return {
        **payload,
        'public_id': claim.public_id,
        'lock_version': claim.lock_version,
        'impact_token': create_impact_token(
            revision=claim.lock_version,
            operation=f'company_domain_claim.{action}',
            resource_key=claim.public_id,
            normalized_payload=payload,
        ),
    }


@transaction.atomic
def confirm_domain_claim_admin_action(
    claim,
    *,
    actor,
    action,
    reason,
    impact_token,
):
    require_admin(actor)
    if not (reason or '').strip():
        raise DomainClaimError('reason_required', _('Vui lòng nhập lý do xử lý.'))
    locked = (
        CompanyDomainClaim.objects.select_for_update()
        .select_related('requested_by')
        .get(pk=claim.pk)
    )
    reason = (reason or '').strip()
    payload = {
        'action': action,
        'reason': reason,
        'status': locked.status,
        'domain': locked.domain,
    }
    try:
        claims = decode_impact_token(
            impact_token,
            operation=f'company_domain_claim.{action}',
            resource_key=locked.public_id,
            normalized_payload=payload,
        )
    except (InvalidImpactToken, StaleImpactToken):
        raise
    if claims['revision'] != locked.lock_version:
        raise StaleImpactToken(_('Dữ liệu đã thay đổi. Vui lòng xem lại tác động.'))
    now = timezone.now()
    if action == 'approve_manual':
        if (
            locked.method != CompanyDomainClaim.Method.ADMIN_MANUAL
            or locked.status != CompanyDomainClaim.Status.PENDING
        ):
            raise DomainClaimError('invalid_status', _('Yêu cầu không còn chờ duyệt thủ công.'))
        try:
            current_requester_domain = verified_email_domain(locked.requested_by)
        except DomainClaimError as error:
            raise DomainClaimError(
                'email_domain_changed',
                _('Email hiện tại của người yêu cầu không còn là bằng chứng hợp lệ.'),
            ) from error
        if current_requester_domain != locked.domain:
            raise DomainClaimError(
                'email_domain_changed',
                _('Email hiện tại của người yêu cầu không còn khớp tên miền.'),
            )
        legal_case = EmployerVerificationCase.objects.filter(
            recruiter__user_id=locked.requested_by_id,
            company_id=locked.company_id,
            status=EmployerVerificationCase.Status.APPROVED,
        ).first()
        legal_checks = verification_checks(legal_case) if legal_case else {}
        if not (
            legal_checks.get('case_approved') and legal_checks.get('business_documents_approved')
        ):
            raise DomainClaimError(
                'legal_verification_required',
                _('Hồ sơ pháp lý của người yêu cầu chưa được duyệt.'),
            )
        assert_no_active_conflict(locked)
        locked.status = CompanyDomainClaim.Status.VERIFIED
        locked.verified_at = now
        locked.expires_at = _add_months(now, 12)
        locked.next_check_at = None
        locked.token_hash = ''
        locked.challenge_expires_at = None
        event_type = CompanyDomainClaimEvent.EventType.MANUAL_APPROVED
    elif action == 'reject_manual':
        if (
            locked.method != CompanyDomainClaim.Method.ADMIN_MANUAL
            or locked.status != CompanyDomainClaim.Status.PENDING
        ):
            raise DomainClaimError('invalid_status', _('Yêu cầu không còn chờ duyệt thủ công.'))
        locked.status = CompanyDomainClaim.Status.REJECTED
        locked.expires_at = None
        locked.token_hash = ''
        locked.challenge_expires_at = None
        event_type = CompanyDomainClaimEvent.EventType.MANUAL_REJECTED
    elif action == 'revoke':
        if locked.status not in {
            CompanyDomainClaim.Status.VERIFIED,
            CompanyDomainClaim.Status.GRACE,
        }:
            raise DomainClaimError(
                'invalid_status', _('Chỉ tên miền đang có hiệu lực mới được thu hồi.')
            )
        locked.status = CompanyDomainClaim.Status.REVOKED
        locked.next_check_at = None
        locked.grace_expires_at = None
        event_type = CompanyDomainClaimEvent.EventType.REVOKED
    else:
        raise DomainClaimError('invalid_action', _('Thao tác không hợp lệ.'))
    locked.reviewer = actor
    locked.review_reason = reason
    locked.lock_version += 1
    try:
        locked.save()
    except IntegrityError as error:
        raise DomainClaimError(
            'domain_owned_by_another_company',
            _('Tên miền đã được một công ty khác xác minh.'),
        ) from error
    record_claim_event(locked, event_type, actor=actor, payload={'reason': reason})
    record_admin_action(
        actor=actor,
        action=f'{action}_company_domain_claim',
        target_type='company_domain_claim',
        target_public_id=locked.public_id,
        payload={
            'company_public_id': locked.company.public_id,
            'domain': locked.domain,
            'reason': reason,
            'lock_version': locked.lock_version,
        },
    )
    return locked

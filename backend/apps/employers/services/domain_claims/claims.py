"""Recruiter-side claim lifecycle: create, verify by DNS, rotate, ask for manual review, recheck."""

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from ...models import (
    CompanyDomainClaim,
    CompanyDomainClaimEvent,
)
from ...models.readiness import has_explicit_company_link
from .domains import (
    DomainClaimError,
    dns_txt_values,
    domain_claim_txt_name,
    domain_claim_txt_value,
    new_challenge,
    txt_matches,
    verified_email_domain,
)

CHALLENGE_LIFETIME = timedelta(hours=72)
DNS_RECHECK_INTERVAL = timedelta(days=30)
DNS_RETRY_INTERVAL = timedelta(days=1)
DNS_GRACE_PERIOD = timedelta(days=7)


def record_claim_event(claim, event_type, *, actor=None, payload=None):
    return CompanyDomainClaimEvent.objects.create(
        claim=claim,
        actor=actor,
        event_type=event_type,
        payload=payload or {},
    )


def _assert_company_recruiter(recruiter):
    if recruiter.company_id is None or not has_explicit_company_link(recruiter):
        raise DomainClaimError('company_required', _('Bạn chưa liên kết với công ty nào.'))


@transaction.atomic
def create_domain_claim(*, recruiter):
    """Create/refresh the claim derived from the recruiter's current e-mail."""

    _assert_company_recruiter(recruiter)
    domain = verified_email_domain(recruiter.user)
    # Lock company to serialize two first challenges for the same exact domain.
    type(recruiter.company).objects.select_for_update().get(pk=recruiter.company_id)
    claim = (
        CompanyDomainClaim.objects.select_for_update()
        .filter(company_id=recruiter.company_id, domain=domain)
        .first()
    )
    if claim and claim.status in {
        CompanyDomainClaim.Status.VERIFIED,
        CompanyDomainClaim.Status.GRACE,
    }:
        raise DomainClaimError('already_verified', _('Tên miền này đã được xác minh.'))
    token, token_hash = new_challenge()
    now = timezone.now()
    if claim is None:
        claim = CompanyDomainClaim.objects.create(
            company_id=recruiter.company_id,
            requested_by=recruiter.user,
            domain=domain,
            method=CompanyDomainClaim.Method.DNS_TXT,
            status=CompanyDomainClaim.Status.PENDING,
            token_hash=token_hash,
            challenge_expires_at=now + CHALLENGE_LIFETIME,
        )
        event_type = CompanyDomainClaimEvent.EventType.CHALLENGE_CREATED
    else:
        claim.requested_by = recruiter.user
        claim.method = CompanyDomainClaim.Method.DNS_TXT
        claim.status = CompanyDomainClaim.Status.PENDING
        claim.token_hash = token_hash
        claim.challenge_expires_at = now + CHALLENGE_LIFETIME
        claim.manual_review_requested_at = None
        claim.grace_expires_at = None
        claim.expires_at = None
        claim.reviewer = None
        claim.review_reason = ''
        claim.revision += 1
        claim.lock_version += 1
        claim.save()
        event_type = CompanyDomainClaimEvent.EventType.CHALLENGE_ROTATED
    record_claim_event(
        claim, event_type, actor=recruiter.user, payload={'revision': claim.revision}
    )
    return claim, domain_claim_txt_value(token)


def _lock_claim_for_recruiter(*, claim_public_id, recruiter):
    _assert_company_recruiter(recruiter)
    claim = (
        CompanyDomainClaim.objects.select_for_update()
        .filter(public_id=claim_public_id, company_id=recruiter.company_id)
        .first()
    )
    if claim is None:
        raise DomainClaimError('not_found', _('Không tìm thấy yêu cầu xác minh tên miền.'))
    return claim


def assert_no_active_conflict(claim):
    # Serialize claims for the domain before relying on the partial unique
    # constraint. Pending claims intentionally do not reserve a global domain.
    conflicts = list(
        CompanyDomainClaim.objects.select_for_update()
        .filter(
            domain=claim.domain,
            status__in=[CompanyDomainClaim.Status.VERIFIED, CompanyDomainClaim.Status.GRACE],
        )
        .exclude(company_id=claim.company_id)
        .values_list('public_id', flat=True)
    )
    if conflicts:
        raise DomainClaimError(
            'domain_owned_by_another_company',
            _('Tên miền đã được một công ty khác xác minh. Vui lòng yêu cầu quản trị hỗ trợ.'),
        )


def verify_domain_claim(*, claim_public_id, recruiter, resolver=None):
    _assert_company_recruiter(recruiter)
    snapshot = CompanyDomainClaim.objects.filter(
        public_id=claim_public_id,
        company_id=recruiter.company_id,
    ).first()
    if snapshot is None:
        raise DomainClaimError('not_found', _('Không tìm thấy yêu cầu xác minh tên miền.'))
    if verified_email_domain(recruiter.user) != snapshot.domain:
        raise DomainClaimError('email_domain_changed', _('Email hiện tại không còn khớp tên miền.'))
    if snapshot.method != CompanyDomainClaim.Method.DNS_TXT or snapshot.status not in {
        CompanyDomainClaim.Status.PENDING,
        CompanyDomainClaim.Status.GRACE,
    }:
        raise DomainClaimError('invalid_status', _('Yêu cầu này không thể kiểm tra DNS.'))
    resolver_error = None
    try:
        # DNS runs before acquiring a row lock so a slow resolver never holds a
        # database transaction open. The challenge is revalidated under lock.
        values = (resolver or dns_txt_values)(domain_claim_txt_name(snapshot.domain))
    except DomainClaimError as error:
        values = set()
        resolver_error = error
    outcome_error = None
    with transaction.atomic():
        claim = _lock_claim_for_recruiter(
            claim_public_id=claim_public_id,
            recruiter=recruiter,
        )
        if verified_email_domain(recruiter.user) != claim.domain:
            raise DomainClaimError(
                'email_domain_changed', _('Email hiện tại không còn khớp tên miền.')
            )
        if claim.method != CompanyDomainClaim.Method.DNS_TXT or claim.status not in {
            CompanyDomainClaim.Status.PENDING,
            CompanyDomainClaim.Status.GRACE,
        }:
            raise DomainClaimError('invalid_status', _('Yêu cầu này không thể kiểm tra DNS.'))
        now = timezone.now()
        if claim.status == CompanyDomainClaim.Status.PENDING and (
            claim.challenge_expires_at is None or claim.challenge_expires_at <= now
        ):
            claim.status = CompanyDomainClaim.Status.EXPIRED
            claim.lock_version += 1
            claim.save(update_fields=['status', 'lock_version', 'updated_at'])
            record_claim_event(
                claim, CompanyDomainClaimEvent.EventType.EXPIRED, actor=recruiter.user
            )
            outcome_error = DomainClaimError(
                'challenge_expired', _('Challenge đã hết hạn. Hãy tạo mã mới.')
            )
        elif resolver_error or not txt_matches(claim, values):
            claim.last_checked_at = now
            claim.lock_version += 1
            claim.save(update_fields=['last_checked_at', 'lock_version', 'updated_at'])
            record_claim_event(
                claim, CompanyDomainClaimEvent.EventType.DNS_CHECK_FAILED, actor=recruiter.user
            )
            outcome_error = resolver_error or DomainClaimError(
                'dns_check_failed', _('Chưa tìm thấy bản ghi TXT hợp lệ.')
            )
        else:
            assert_no_active_conflict(claim)
            was_grace = claim.status == CompanyDomainClaim.Status.GRACE
            claim.status = CompanyDomainClaim.Status.VERIFIED
            claim.method = CompanyDomainClaim.Method.DNS_TXT
            claim.verified_at = now
            claim.last_checked_at = now
            claim.next_check_at = now + DNS_RECHECK_INTERVAL
            claim.grace_expires_at = None
            claim.expires_at = None
            claim.lock_version += 1
            try:
                claim.save()
            except IntegrityError as error:
                raise DomainClaimError(
                    'domain_owned_by_another_company',
                    _('Tên miền đã được một công ty khác xác minh.'),
                ) from error
            record_claim_event(
                claim,
                CompanyDomainClaimEvent.EventType.REVERIFIED
                if was_grace
                else CompanyDomainClaimEvent.EventType.DNS_CHECK_PASSED,
                actor=recruiter.user,
            )
    if outcome_error:
        raise outcome_error
    return claim


@transaction.atomic
def rotate_domain_claim(*, claim_public_id, recruiter, lock_version):
    claim = _lock_claim_for_recruiter(claim_public_id=claim_public_id, recruiter=recruiter)
    if claim.lock_version != lock_version:
        raise DomainClaimError('resource_changed', _('Dữ liệu đã thay đổi. Vui lòng tải lại.'))
    if claim.status not in {
        CompanyDomainClaim.Status.PENDING,
        CompanyDomainClaim.Status.REJECTED,
        CompanyDomainClaim.Status.REVOKED,
        CompanyDomainClaim.Status.EXPIRED,
        CompanyDomainClaim.Status.LEGACY_INFERRED,
    }:
        raise DomainClaimError(
            'invalid_status', _('Không thể đổi challenge ở trạng thái hiện tại.')
        )
    # Identity is re-derived on every sensitive action. A changed e-mail cannot
    # rotate a challenge that was issued for the old domain.
    if verified_email_domain(recruiter.user) != claim.domain:
        raise DomainClaimError('email_domain_changed', _('Email hiện tại không còn khớp tên miền.'))
    token, token_hash = new_challenge()
    now = timezone.now()
    claim.requested_by = recruiter.user
    claim.method = CompanyDomainClaim.Method.DNS_TXT
    claim.status = CompanyDomainClaim.Status.PENDING
    claim.token_hash = token_hash
    claim.challenge_expires_at = now + CHALLENGE_LIFETIME
    claim.manual_review_requested_at = None
    claim.review_reason = ''
    claim.reviewer = None
    claim.revision += 1
    claim.lock_version += 1
    claim.save()
    record_claim_event(
        claim,
        CompanyDomainClaimEvent.EventType.CHALLENGE_ROTATED,
        actor=recruiter.user,
        payload={'revision': claim.revision},
    )
    return claim, domain_claim_txt_value(token)


@transaction.atomic
def request_manual_domain_review(*, claim_public_id, recruiter, lock_version, reason):
    claim = _lock_claim_for_recruiter(claim_public_id=claim_public_id, recruiter=recruiter)
    if claim.lock_version != lock_version:
        raise DomainClaimError('resource_changed', _('Dữ liệu đã thay đổi. Vui lòng tải lại.'))
    reason = (reason or '').strip()
    if not reason:
        raise DomainClaimError('reason_required', _('Vui lòng nêu lý do cần duyệt thủ công.'))
    if verified_email_domain(recruiter.user) != claim.domain:
        raise DomainClaimError('email_domain_changed', _('Email hiện tại không còn khớp tên miền.'))
    if claim.status not in {
        CompanyDomainClaim.Status.PENDING,
        CompanyDomainClaim.Status.REJECTED,
        CompanyDomainClaim.Status.LEGACY_INFERRED,
    }:
        raise DomainClaimError(
            'invalid_status', _('Không thể yêu cầu duyệt ở trạng thái hiện tại.')
        )
    claim.requested_by = recruiter.user
    claim.method = CompanyDomainClaim.Method.ADMIN_MANUAL
    claim.status = CompanyDomainClaim.Status.PENDING
    claim.manual_review_requested_at = timezone.now()
    claim.review_reason = reason
    claim.token_hash = ''
    claim.challenge_expires_at = None
    claim.lock_version += 1
    claim.save()
    record_claim_event(
        claim,
        CompanyDomainClaimEvent.EventType.MANUAL_REVIEW_REQUESTED,
        actor=recruiter.user,
        payload={'reason': reason},
    )
    return claim


@transaction.atomic
def reconcile_domain_claim(claim, *, resolver=None, now=None):
    """Recheck one DNS claim or expire a time-bounded manual claim."""

    now = now or timezone.now()
    locked = CompanyDomainClaim.objects.select_for_update().get(pk=claim.pk)
    if (
        locked.status == CompanyDomainClaim.Status.VERIFIED
        and locked.method == CompanyDomainClaim.Method.ADMIN_MANUAL
    ):
        if locked.expires_at and locked.expires_at <= now:
            locked.status = CompanyDomainClaim.Status.EXPIRED
            locked.lock_version += 1
            locked.save(update_fields=['status', 'lock_version', 'updated_at'])
            record_claim_event(locked, CompanyDomainClaimEvent.EventType.EXPIRED)
        return locked
    if locked.method != CompanyDomainClaim.Method.DNS_TXT or locked.status not in {
        CompanyDomainClaim.Status.VERIFIED,
        CompanyDomainClaim.Status.GRACE,
    }:
        return locked
    try:
        values = (resolver or dns_txt_values)(domain_claim_txt_name(locked.domain))
        matched = txt_matches(locked, values)
    except DomainClaimError:
        matched = False
    locked.last_checked_at = now
    if matched:
        locked.status = CompanyDomainClaim.Status.VERIFIED
        locked.next_check_at = now + DNS_RECHECK_INTERVAL
        locked.grace_expires_at = None
        event_type = CompanyDomainClaimEvent.EventType.REVERIFIED
    elif locked.status == CompanyDomainClaim.Status.VERIFIED:
        locked.status = CompanyDomainClaim.Status.GRACE
        locked.grace_expires_at = now + DNS_GRACE_PERIOD
        locked.next_check_at = now + DNS_RETRY_INTERVAL
        event_type = CompanyDomainClaimEvent.EventType.GRACE_STARTED
    elif locked.grace_expires_at and locked.grace_expires_at <= now:
        locked.status = CompanyDomainClaim.Status.REVOKED
        locked.next_check_at = None
        event_type = CompanyDomainClaimEvent.EventType.REVOKED
    else:
        locked.next_check_at = now + DNS_RETRY_INTERVAL
        event_type = CompanyDomainClaimEvent.EventType.DNS_CHECK_FAILED
    locked.lock_version += 1
    locked.save()
    record_claim_event(locked, event_type)
    return locked

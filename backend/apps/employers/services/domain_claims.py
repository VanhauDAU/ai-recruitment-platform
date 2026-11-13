import hashlib
import secrets
from calendar import monthrange
from datetime import timedelta

import idna
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.permissions import require_admin_permission
from apps.accounts.services import (
    InvalidImpactToken,
    StaleImpactToken,
    create_impact_token,
    decode_impact_token,
    record_admin_action,
)
from common.company_email import PUBLIC_EMAIL_DOMAINS

from ..models import (
    CompanyDomainClaim,
    CompanyDomainClaimEvent,
    EmployerVerificationCase,
)
from ..models.readiness import has_explicit_company_link
from .verification import verification_checks

CHALLENGE_LIFETIME = timedelta(hours=72)
DNS_RECHECK_INTERVAL = timedelta(days=30)
DNS_RETRY_INTERVAL = timedelta(days=1)
DNS_GRACE_PERIOD = timedelta(days=7)
TXT_PREFIX = 'procv-verification='


class DomainClaimError(ValueError):
    def __init__(self, code, detail):
        self.code = code
        self.detail = detail
        super().__init__(detail)


def _offline_tld_extract(domain):
    """Resolve a registrable suffix without downloading the PSL at runtime."""

    try:
        import tldextract
    except ImportError as error:
        raise DomainClaimError(
            'domain_validation_unavailable',
            'Dịch vụ kiểm tra hậu tố tên miền chưa sẵn sàng.',
        ) from error
    result = tldextract.TLDExtract(suffix_list_urls=())(domain)
    return bool(result.domain and result.suffix)


def normalize_company_domain(value):
    """Return one exact lower-case IDNA ASCII domain or fail closed."""

    candidate = (value or '').strip().rstrip('.').lower()
    if not candidate or '@' in candidate or candidate.startswith('*.'):
        raise DomainClaimError('invalid_domain', 'Tên miền không hợp lệ.')
    try:
        normalized = idna.encode(candidate, uts46=True, std3_rules=True).decode('ascii')
    except (idna.IDNAError, UnicodeError) as error:
        raise DomainClaimError('invalid_domain', 'Tên miền không hợp lệ.') from error
    if len(normalized) > 253 or any(len(label) > 63 for label in normalized.split('.')):
        raise DomainClaimError('invalid_domain', 'Tên miền không hợp lệ.')
    if not _offline_tld_extract(normalized):
        raise DomainClaimError('public_suffix', 'Tên miền phải có hậu tố công khai hợp lệ.')
    if normalized in PUBLIC_EMAIL_DOMAINS:
        raise DomainClaimError(
            'public_email_domain',
            'Không thể xác minh tên miền của dịch vụ email công cộng.',
        )
    return normalized


def verified_email_domain(user):
    if not user.email_verified:
        raise DomainClaimError(
            'email_not_verified',
            'Hãy xác thực email công việc trước khi xác minh tên miền.',
        )
    _, separator, raw_domain = (user.email or '').strip().rpartition('@')
    if not separator:
        raise DomainClaimError('invalid_email', 'Email hiện tại không hợp lệ.')
    return normalize_company_domain(raw_domain)


def _token_hash(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _new_challenge():
    token = secrets.token_urlsafe(32)
    return token, _token_hash(token)


def domain_claim_txt_name(domain):
    return f'_procv-verification.{domain}'


def domain_claim_txt_value(token):
    return f'{TXT_PREFIX}{token}'


def _event(claim, event_type, *, actor=None, payload=None):
    return CompanyDomainClaimEvent.objects.create(
        claim=claim,
        actor=actor,
        event_type=event_type,
        payload=payload or {},
    )


def _assert_company_recruiter(recruiter):
    if recruiter.company_id is None or not has_explicit_company_link(recruiter):
        raise DomainClaimError('company_required', 'Bạn chưa liên kết với công ty nào.')


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
        raise DomainClaimError('already_verified', 'Tên miền này đã được xác minh.')
    token, token_hash = _new_challenge()
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
    _event(claim, event_type, actor=recruiter.user, payload={'revision': claim.revision})
    return claim, domain_claim_txt_value(token)


def _dns_txt_values(name):
    """Read TXT records with a bounded resolver lifetime."""

    try:
        import dns.exception
        import dns.resolver
    except ImportError as error:
        raise DomainClaimError(
            'dns_unavailable',
            'Dịch vụ kiểm tra DNS chưa sẵn sàng.',
        ) from error
    resolver = dns.resolver.Resolver(configure=True)
    resolver.lifetime = float(getattr(settings, 'EMPLOYER_DOMAIN_DNS_TIMEOUT_SECONDS', 3.0))
    try:
        answers = resolver.resolve(name, 'TXT')
    except (dns.exception.DNSException, OSError) as error:
        raise DomainClaimError('dns_check_failed', 'Chưa tìm thấy bản ghi TXT hợp lệ.') from error
    values = set()
    for answer in answers:
        strings = getattr(answer, 'strings', None)
        if strings is not None:
            values.add(b''.join(strings).decode('utf-8', errors='replace').strip())
        else:
            values.add(answer.to_text().strip().strip('"'))
    return values


def _txt_matches(claim, values):
    for value in values:
        if not value.startswith(TXT_PREFIX):
            continue
        if secrets.compare_digest(
            _token_hash(value.removeprefix(TXT_PREFIX).strip()), claim.token_hash
        ):
            return True
    return False


def _lock_claim_for_recruiter(*, claim_public_id, recruiter):
    _assert_company_recruiter(recruiter)
    claim = (
        CompanyDomainClaim.objects.select_for_update()
        .filter(public_id=claim_public_id, company_id=recruiter.company_id)
        .first()
    )
    if claim is None:
        raise DomainClaimError('not_found', 'Không tìm thấy yêu cầu xác minh tên miền.')
    return claim


def _assert_no_active_conflict(claim):
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
            'Tên miền đã được một công ty khác xác minh. Vui lòng yêu cầu quản trị hỗ trợ.',
        )


def verify_domain_claim(*, claim_public_id, recruiter, resolver=None):
    _assert_company_recruiter(recruiter)
    snapshot = CompanyDomainClaim.objects.filter(
        public_id=claim_public_id,
        company_id=recruiter.company_id,
    ).first()
    if snapshot is None:
        raise DomainClaimError('not_found', 'Không tìm thấy yêu cầu xác minh tên miền.')
    if verified_email_domain(recruiter.user) != snapshot.domain:
        raise DomainClaimError('email_domain_changed', 'Email hiện tại không còn khớp tên miền.')
    if snapshot.method != CompanyDomainClaim.Method.DNS_TXT or snapshot.status not in {
        CompanyDomainClaim.Status.PENDING,
        CompanyDomainClaim.Status.GRACE,
    }:
        raise DomainClaimError('invalid_status', 'Yêu cầu này không thể kiểm tra DNS.')
    resolver_error = None
    try:
        # DNS runs before acquiring a row lock so a slow resolver never holds a
        # database transaction open. The challenge is revalidated under lock.
        values = (resolver or _dns_txt_values)(domain_claim_txt_name(snapshot.domain))
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
                'email_domain_changed', 'Email hiện tại không còn khớp tên miền.'
            )
        if claim.method != CompanyDomainClaim.Method.DNS_TXT or claim.status not in {
            CompanyDomainClaim.Status.PENDING,
            CompanyDomainClaim.Status.GRACE,
        }:
            raise DomainClaimError('invalid_status', 'Yêu cầu này không thể kiểm tra DNS.')
        now = timezone.now()
        if claim.status == CompanyDomainClaim.Status.PENDING and (
            claim.challenge_expires_at is None or claim.challenge_expires_at <= now
        ):
            claim.status = CompanyDomainClaim.Status.EXPIRED
            claim.lock_version += 1
            claim.save(update_fields=['status', 'lock_version', 'updated_at'])
            _event(claim, CompanyDomainClaimEvent.EventType.EXPIRED, actor=recruiter.user)
            outcome_error = DomainClaimError(
                'challenge_expired', 'Challenge đã hết hạn. Hãy tạo mã mới.'
            )
        elif resolver_error or not _txt_matches(claim, values):
            claim.last_checked_at = now
            claim.lock_version += 1
            claim.save(update_fields=['last_checked_at', 'lock_version', 'updated_at'])
            _event(claim, CompanyDomainClaimEvent.EventType.DNS_CHECK_FAILED, actor=recruiter.user)
            outcome_error = resolver_error or DomainClaimError(
                'dns_check_failed', 'Chưa tìm thấy bản ghi TXT hợp lệ.'
            )
        else:
            _assert_no_active_conflict(claim)
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
                    'Tên miền đã được một công ty khác xác minh.',
                ) from error
            _event(
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
        raise DomainClaimError('resource_changed', 'Dữ liệu đã thay đổi. Vui lòng tải lại.')
    if claim.status not in {
        CompanyDomainClaim.Status.PENDING,
        CompanyDomainClaim.Status.REJECTED,
        CompanyDomainClaim.Status.REVOKED,
        CompanyDomainClaim.Status.EXPIRED,
        CompanyDomainClaim.Status.LEGACY_INFERRED,
    }:
        raise DomainClaimError('invalid_status', 'Không thể đổi challenge ở trạng thái hiện tại.')
    # Identity is re-derived on every sensitive action. A changed e-mail cannot
    # rotate a challenge that was issued for the old domain.
    if verified_email_domain(recruiter.user) != claim.domain:
        raise DomainClaimError('email_domain_changed', 'Email hiện tại không còn khớp tên miền.')
    token, token_hash = _new_challenge()
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
    _event(
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
        raise DomainClaimError('resource_changed', 'Dữ liệu đã thay đổi. Vui lòng tải lại.')
    reason = (reason or '').strip()
    if not reason:
        raise DomainClaimError('reason_required', 'Vui lòng nêu lý do cần duyệt thủ công.')
    if verified_email_domain(recruiter.user) != claim.domain:
        raise DomainClaimError('email_domain_changed', 'Email hiện tại không còn khớp tên miền.')
    if claim.status not in {
        CompanyDomainClaim.Status.PENDING,
        CompanyDomainClaim.Status.REJECTED,
        CompanyDomainClaim.Status.LEGACY_INFERRED,
    }:
        raise DomainClaimError('invalid_status', 'Không thể yêu cầu duyệt ở trạng thái hiện tại.')
    claim.requested_by = recruiter.user
    claim.method = CompanyDomainClaim.Method.ADMIN_MANUAL
    claim.status = CompanyDomainClaim.Status.PENDING
    claim.manual_review_requested_at = timezone.now()
    claim.review_reason = reason
    claim.token_hash = ''
    claim.challenge_expires_at = None
    claim.lock_version += 1
    claim.save()
    _event(
        claim,
        CompanyDomainClaimEvent.EventType.MANUAL_REVIEW_REQUESTED,
        actor=recruiter.user,
        payload={'reason': reason},
    )
    return claim


def _add_months(value, count):
    month_index = value.month - 1 + count
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def domain_claim_admin_impact(claim, *, actor, action, reason):
    reason = (reason or '').strip()
    if not reason:
        raise DomainClaimError('reason_required', 'Vui lòng nhập lý do xử lý.')
    if action not in {'approve_manual', 'reject_manual', 'revoke'}:
        raise DomainClaimError('invalid_action', 'Thao tác không hợp lệ.')
    require_admin_permission(
        actor,
        'employer_domain.revoke' if action == 'revoke' else 'employer_domain.review',
    )
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
    require_admin_permission(
        actor,
        'employer_domain.revoke' if action == 'revoke' else 'employer_domain.review',
    )
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
        raise StaleImpactToken('Dữ liệu đã thay đổi. Vui lòng xem lại tác động.')
    now = timezone.now()
    if action == 'approve_manual':
        if (
            locked.method != CompanyDomainClaim.Method.ADMIN_MANUAL
            or locked.status != CompanyDomainClaim.Status.PENDING
        ):
            raise DomainClaimError('invalid_status', 'Yêu cầu không còn chờ duyệt thủ công.')
        try:
            current_requester_domain = verified_email_domain(locked.requested_by)
        except DomainClaimError as error:
            raise DomainClaimError(
                'email_domain_changed',
                'Email hiện tại của người yêu cầu không còn là bằng chứng hợp lệ.',
            ) from error
        if current_requester_domain != locked.domain:
            raise DomainClaimError(
                'email_domain_changed',
                'Email hiện tại của người yêu cầu không còn khớp tên miền.',
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
                'Hồ sơ pháp lý của người yêu cầu chưa được duyệt.',
            )
        _assert_no_active_conflict(locked)
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
            raise DomainClaimError('invalid_status', 'Yêu cầu không còn chờ duyệt thủ công.')
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
                'invalid_status', 'Chỉ tên miền đang có hiệu lực mới được thu hồi.'
            )
        locked.status = CompanyDomainClaim.Status.REVOKED
        locked.next_check_at = None
        locked.grace_expires_at = None
        event_type = CompanyDomainClaimEvent.EventType.REVOKED
    else:
        raise DomainClaimError('invalid_action', 'Thao tác không hợp lệ.')
    locked.reviewer = actor
    locked.review_reason = reason
    locked.lock_version += 1
    try:
        locked.save()
    except IntegrityError as error:
        raise DomainClaimError(
            'domain_owned_by_another_company',
            'Tên miền đã được một công ty khác xác minh.',
        ) from error
    _event(locked, event_type, actor=actor, payload={'reason': reason})
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
            _event(locked, CompanyDomainClaimEvent.EventType.EXPIRED)
        return locked
    if locked.method != CompanyDomainClaim.Method.DNS_TXT or locked.status not in {
        CompanyDomainClaim.Status.VERIFIED,
        CompanyDomainClaim.Status.GRACE,
    }:
        return locked
    try:
        values = (resolver or _dns_txt_values)(domain_claim_txt_name(locked.domain))
        matched = _txt_matches(locked, values)
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
    _event(locked, event_type)
    return locked

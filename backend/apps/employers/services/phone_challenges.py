"""Secure persistence and dispatch lifecycle for future SMS phone challenges."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import timedelta

from celery import current_app
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from common.metrics import record_metric
from common.public_id import generate_public_id

from ..models import EmployerPhoneVerificationEvent, PhoneOtp
from .sms_provider import (
    SmsMessage,
    SmsProviderDisabled,
    SmsProviderError,
    SmsProviderPermanentError,
    get_sms_provider,
)

SMS_OTP_TTL = timedelta(minutes=10)
SMS_OTP_COOLDOWN = timedelta(seconds=60)
SMS_MAX_VERIFY_ATTEMPTS = 5
SMS_MAX_DISPATCH_ATTEMPTS = 4
_SMS_PURPOSES = {
    PhoneOtp.Purpose.INITIAL_VERIFICATION,
    PhoneOtp.Purpose.PHONE_CHANGE,
    PhoneOtp.Purpose.REVERIFY,
}


class PhoneChallengeError(Exception):
    """Stable, presentation-neutral failure for the live SMS workflow."""

    def __init__(self, code, message, *, retryable=False, retry_after_seconds=None):
        self.code = code
        self.message = message
        self.retryable = retryable
        self.retry_after_seconds = retry_after_seconds
        super().__init__(code)


def normalize_vietnamese_mobile(value):
    """Return canonical +84 mobile form or raise a domain validation error."""

    compact = ''.join(character for character in (value or '').strip() if character not in ' .-()')
    if compact.startswith('0'):
        compact = f'+84{compact[1:]}'
    if len(compact) != 12 or not compact.startswith('+84'):
        raise ValidationError('Số điện thoại phải là số di động Việt Nam hợp lệ.')
    subscriber = compact[3:]
    if len(subscriber) != 9 or subscriber[0] not in '35789' or not subscriber.isdigit():
        raise ValidationError('Số điện thoại phải là số di động Việt Nam hợp lệ.')
    return compact


def _hmac_key():
    configured = settings.EMPLOYER_SMS_CHALLENGE_HMAC_KEY
    if configured:
        return configured.encode()
    if settings.IS_PRODUCTION:
        raise ImproperlyConfigured('EMPLOYER_SMS_CHALLENGE_HMAC_KEY is required.')
    return hmac.new(
        settings.SECRET_KEY.encode(),
        b'employer-sms-development-hmac',
        hashlib.sha256,
    ).digest()


def _payload_fernet():
    configured = settings.EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY
    if configured:
        try:
            return Fernet(configured.encode())
        except (TypeError, ValueError) as error:
            raise ImproperlyConfigured(
                'EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY must be a valid Fernet key.'
            ) from error
    if settings.IS_PRODUCTION:
        raise ImproperlyConfigured('EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY is required.')
    derived = hashlib.sha256(
        f'{settings.SECRET_KEY}:employer-sms-development-payload'.encode()
    ).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def phone_fingerprint(phone):
    canonical = normalize_vietnamese_mobile(phone)
    return hmac.new(_hmac_key(), f'phone:v1:{canonical}'.encode(), hashlib.sha256).hexdigest()


def hash_challenge_code(challenge_public_id, code):
    payload = f'phone-otp:v1:{challenge_public_id}:{code}'.encode()
    return hmac.new(_hmac_key(), payload, hashlib.sha256).hexdigest()


def challenge_code_matches(challenge, code):
    return hmac.compare_digest(
        challenge.code_hash,
        hash_challenge_code(challenge.public_id, code),
    )


def _encrypt(value):
    return _payload_fernet().encrypt(value.encode()).decode()


def _decrypt(ciphertext):
    try:
        return _payload_fernet().decrypt(ciphertext.encode()).decode()
    except (ImproperlyConfigured, InvalidToken, UnicodeDecodeError, ValueError) as error:
        raise SmsProviderPermanentError('challenge_payload_unreadable') from error


def _append_event(challenge, event_type, *, outcome='', reason_code=''):
    return EmployerPhoneVerificationEvent.objects.create(
        user_id=challenge.user_id,
        challenge_public_id=challenge.public_id,
        purpose=challenge.purpose,
        event_type=event_type,
        outcome=outcome[:24],
        reason_code=reason_code[:50],
    )


def _canonical_variants(canonical_phone):
    return {canonical_phone, f'0{canonical_phone[3:]}'}


def _challenge_purpose(recruiter, canonical_phone):
    if recruiter.phone_verified_at is None or not recruiter.verified_phone:
        return PhoneOtp.Purpose.INITIAL_VERIFICATION
    try:
        current_phone = normalize_vietnamese_mobile(recruiter.verified_phone)
    except ValidationError:
        current_phone = recruiter.verified_phone
    if current_phone == canonical_phone:
        return PhoneOtp.Purpose.REVERIFY
    return PhoneOtp.Purpose.PHONE_CHANGE


def phone_challenge_snapshot(challenge):
    """Return only state needed by the owner UI; never expose phone or provider data."""

    now = timezone.now()
    expired = challenge.expires_at <= now and challenge.verified_at is None
    status = 'expired' if expired else challenge.dispatch_status
    failure_code = (
        challenge.dispatch_error_code
        if status
        in {
            PhoneOtp.DispatchStatus.FAILED,
            PhoneOtp.DispatchStatus.DISABLED,
        }
        else ''
    )
    return {
        'public_id': challenge.public_id,
        'purpose': challenge.purpose,
        'status': status,
        'failure_code': failure_code,
        'expires_at': challenge.expires_at,
        'attempts_remaining': max(0, SMS_MAX_VERIFY_ATTEMPTS - challenge.attempts),
        'can_verify': (
            status == PhoneOtp.DispatchStatus.SENT
            and challenge.invalidated_at is None
            and challenge.verified_at is None
        ),
        'can_retry': status
        in {
            PhoneOtp.DispatchStatus.FAILED,
            PhoneOtp.DispatchStatus.DISABLED,
            'expired',
        },
    }


@transaction.atomic
def start_sms_phone_verification(*, user, phone, password):
    """Re-authenticate and enqueue an actor-bound SMS challenge."""

    if not settings.EMPLOYER_SMS_OTP_ENABLED:
        raise PhoneChallengeError(
            'PHONE_SMS_DISABLED',
            'Xác thực SMS hiện chưa sẵn sàng. Vui lòng thử lại sau.',
            retryable=True,
        )
    if not user.has_usable_password():
        raise PhoneChallengeError(
            'PHONE_REAUTH_REQUIRED',
            'Tài khoản chưa có mật khẩu. Hãy tạo mật khẩu trước khi xác thực số điện thoại.',
        )
    if not user.check_password((password or '').strip()):
        raise PhoneChallengeError('PHONE_REAUTH_FAILED', 'Mật khẩu không đúng.')

    locked_user = user.__class__.objects.select_for_update().get(pk=user.pk)
    from .profiles import get_or_create_recruiter

    recruiter = get_or_create_recruiter(locked_user)
    recruiter = recruiter.__class__.objects.select_for_update().get(pk=recruiter.pk)
    canonical_phone = normalize_vietnamese_mobile(phone)
    latest = (
        PhoneOtp.objects.filter(user=locked_user, purpose__in=_SMS_PURPOSES)
        .order_by('-created_at')
        .first()
    )
    now = timezone.now()
    if latest and now - latest.created_at < SMS_OTP_COOLDOWN:
        retry_after = max(
            1,
            int((SMS_OTP_COOLDOWN - (now - latest.created_at)).total_seconds()),
        )
        raise PhoneChallengeError(
            'PHONE_OTP_COOLDOWN',
            'Vui lòng chờ trước khi gửi lại mã.',
            retryable=True,
            retry_after_seconds=retry_after,
        )
    challenge = create_sms_phone_challenge(
        user=locked_user,
        phone=canonical_phone,
        purpose=_challenge_purpose(recruiter, canonical_phone),
    )
    enqueue_sms_phone_challenge(challenge)
    return challenge


def get_sms_phone_challenge(*, user, public_id):
    challenge = PhoneOtp.objects.filter(
        user=user,
        public_id=public_id,
        purpose__in=_SMS_PURPOSES,
    ).first()
    if challenge is None:
        raise PhoneChallengeError('RESOURCE_NOT_FOUND', 'Không tìm thấy yêu cầu xác thực.')
    return challenge


@transaction.atomic
def _verify_sms_phone_challenge(*, user, public_id, code):
    """Verify one exact sent challenge and atomically update the phone proof."""

    locked_user = user.__class__.objects.select_for_update().get(pk=user.pk)
    challenge = (
        PhoneOtp.objects.select_for_update()
        .filter(
            user=locked_user,
            public_id=public_id,
            purpose__in=_SMS_PURPOSES,
        )
        .first()
    )
    if challenge is None:
        raise PhoneChallengeError('RESOURCE_NOT_FOUND', 'Không tìm thấy yêu cầu xác thực.')
    now = timezone.now()
    if challenge.invalidated_at is not None:
        raise PhoneChallengeError('PHONE_CHALLENGE_INVALIDATED', 'Mã này đã bị thay thế.')
    if challenge.verified_at is not None:
        raise PhoneChallengeError('PHONE_CHALLENGE_USED', 'Mã này đã được sử dụng.')
    if challenge.expires_at <= now:
        raise PhoneChallengeError('PHONE_CHALLENGE_EXPIRED', 'Mã đã hết hạn.')
    if challenge.dispatch_status != PhoneOtp.DispatchStatus.SENT:
        raise PhoneChallengeError(
            'PHONE_CHALLENGE_NOT_READY',
            'Tin nhắn chưa được gửi thành công.',
            retryable=challenge.dispatch_status
            in {PhoneOtp.DispatchStatus.QUEUED, PhoneOtp.DispatchStatus.DISPATCHING},
        )
    if challenge.attempts >= SMS_MAX_VERIFY_ATTEMPTS:
        raise PhoneChallengeError('PHONE_ATTEMPTS_EXHAUSTED', 'Mã đã hết lượt xác thực.')

    challenge.attempts += 1
    if not challenge_code_matches(challenge, (code or '').strip()):
        update_fields = ['attempts', 'updated_at']
        if challenge.attempts >= SMS_MAX_VERIFY_ATTEMPTS:
            challenge.invalidated_at = now
            challenge.invalidation_reason = 'verify_attempts_exhausted'
            update_fields.extend(['invalidated_at', 'invalidation_reason'])
        challenge.save(update_fields=update_fields)
        return None, PhoneChallengeError('PHONE_CODE_INVALID', 'Mã xác thực không đúng.')

    canonical_phone = normalize_vietnamese_mobile(_decrypt(challenge.destination_ciphertext))
    from ..models import RecruiterProfile
    from .profiles import get_or_create_recruiter
    from .verification import reconcile_recruiter_verification

    recruiter = get_or_create_recruiter(locked_user)
    recruiter = RecruiterProfile.objects.select_for_update().get(pk=recruiter.pk)
    if (
        RecruiterProfile.objects.select_for_update()
        .filter(verified_phone__in=_canonical_variants(canonical_phone))
        .exclude(user=locked_user)
        .exists()
    ):
        raise PhoneChallengeError(
            'PHONE_UNAVAILABLE',
            'Không thể dùng số điện thoại này cho tài khoản.',
        )

    challenge.verified_at = now
    challenge.dispatch_status = PhoneOtp.DispatchStatus.VERIFIED
    challenge.save(update_fields=['attempts', 'verified_at', 'dispatch_status', 'updated_at'])
    try:
        with transaction.atomic():
            recruiter.contact_phone = canonical_phone
            recruiter.verified_phone = canonical_phone
            recruiter.phone_verified_at = now
            recruiter.save(
                update_fields=[
                    'contact_phone',
                    'verified_phone',
                    'phone_verified_at',
                    'updated_at',
                ]
            )
    except IntegrityError as error:
        raise PhoneChallengeError(
            'PHONE_UNAVAILABLE',
            'Không thể dùng số điện thoại này cho tài khoản.',
        ) from error
    if locked_user.phone != canonical_phone:
        locked_user.phone = canonical_phone
        locked_user.save(update_fields=['phone', 'updated_at'])
    _append_event(
        challenge,
        EmployerPhoneVerificationEvent.EventType.VERIFIED,
        outcome='verified',
    )
    reconcile_recruiter_verification(recruiter, source='phone_verified')
    return recruiter, None


def verify_sms_phone_challenge(*, user, public_id, code):
    recruiter, error = _verify_sms_phone_challenge(
        user=user,
        public_id=public_id,
        code=code,
    )
    if error is not None:
        raise error
    return recruiter


@transaction.atomic
def create_sms_phone_challenge(*, user, phone, purpose):
    """Create one encrypted challenge and invalidate every older active one."""

    if purpose not in _SMS_PURPOSES:
        raise ValidationError('Mục đích xác minh số điện thoại không hợp lệ.')
    user.__class__.objects.select_for_update().only('pk').get(pk=user.pk)
    now = timezone.now()
    active = PhoneOtp.objects.select_for_update().filter(
        user=user,
        verified_at__isnull=True,
        invalidated_at__isnull=True,
        purpose__in=_SMS_PURPOSES,
    )
    for old_challenge in active:
        old_challenge.invalidated_at = now
        old_challenge.invalidation_reason = 'superseded'
        old_challenge.otp_ciphertext = ''
        old_challenge.secret_purged_at = now
        old_challenge.save(
            update_fields=[
                'invalidated_at',
                'invalidation_reason',
                'otp_ciphertext',
                'secret_purged_at',
                'updated_at',
            ]
        )
        _append_event(
            old_challenge,
            EmployerPhoneVerificationEvent.EventType.CHALLENGE_INVALIDATED,
            outcome='invalidated',
            reason_code='superseded',
        )

    canonical_phone = normalize_vietnamese_mobile(phone)
    code = f'{secrets.randbelow(1_000_000):06d}'
    public_id = generate_public_id('poc')
    challenge = PhoneOtp.objects.create(
        public_id=public_id,
        user=user,
        purpose=purpose,
        dispatch_status=PhoneOtp.DispatchStatus.QUEUED,
        phone='',
        phone_fingerprint=phone_fingerprint(canonical_phone),
        destination_ciphertext=_encrypt(canonical_phone),
        otp_ciphertext=_encrypt(code),
        code_hash=hash_challenge_code(public_id, code),
        expires_at=now + SMS_OTP_TTL,
    )
    _append_event(
        challenge,
        EmployerPhoneVerificationEvent.EventType.CHALLENGE_CREATED,
        outcome='queued',
    )
    return challenge


def enqueue_sms_phone_challenge(challenge):
    """Enqueue after commit; only the opaque challenge ID crosses the broker."""

    transaction.on_commit(
        lambda: current_app.send_task(
            'apps.employers.tasks.phone_sms.dispatch_employer_sms_challenge',
            args=[challenge.public_id],
        )
    )


@transaction.atomic
def _claim_dispatch(challenge_public_id):
    challenge = PhoneOtp.objects.select_for_update().filter(public_id=challenge_public_id).first()
    if challenge is None:
        return None
    if challenge.invalidated_at or challenge.verified_at or challenge.expires_at <= timezone.now():
        return None
    if challenge.dispatch_status not in {
        PhoneOtp.DispatchStatus.QUEUED,
        PhoneOtp.DispatchStatus.RETRY_PENDING,
    }:
        return None
    if challenge.dispatch_attempts >= SMS_MAX_DISPATCH_ATTEMPTS:
        challenge.dispatch_status = PhoneOtp.DispatchStatus.FAILED
        challenge.dispatch_error_code = 'dispatch_attempt_budget_exhausted'
        challenge.otp_ciphertext = ''
        challenge.secret_purged_at = timezone.now()
        challenge.save(
            update_fields=[
                'dispatch_status',
                'dispatch_error_code',
                'otp_ciphertext',
                'secret_purged_at',
                'updated_at',
            ]
        )
        _append_event(
            challenge,
            EmployerPhoneVerificationEvent.EventType.DISPATCH_FAILED,
            outcome='failed',
            reason_code='dispatch_attempt_budget_exhausted',
        )
        record_metric(
            'employer_sms_dispatch',
            status='failed',
            failure_code='dispatch_attempt_budget_exhausted',
            purpose=challenge.purpose,
        )
        return None
    now = timezone.now()
    challenge.dispatch_status = PhoneOtp.DispatchStatus.DISPATCHING
    challenge.dispatch_attempts += 1
    challenge.dispatch_started_at = now
    challenge.dispatch_error_code = ''
    challenge.save(
        update_fields=[
            'dispatch_status',
            'dispatch_attempts',
            'dispatch_started_at',
            'dispatch_error_code',
            'updated_at',
        ]
    )
    _append_event(
        challenge,
        EmployerPhoneVerificationEvent.EventType.DISPATCH_STARTED,
        outcome='dispatching',
    )
    return challenge


@transaction.atomic
def _mark_dispatch_error(challenge_public_id, error):
    challenge = PhoneOtp.objects.select_for_update().get(public_id=challenge_public_id)
    if challenge.dispatch_status != PhoneOtp.DispatchStatus.DISPATCHING:
        return challenge
    retryable = bool(error.retryable)
    if isinstance(error, SmsProviderDisabled):
        status = PhoneOtp.DispatchStatus.DISABLED
        event_type = EmployerPhoneVerificationEvent.EventType.DISPATCH_DISABLED
    elif retryable:
        status = PhoneOtp.DispatchStatus.RETRY_PENDING
        event_type = EmployerPhoneVerificationEvent.EventType.DISPATCH_RETRY
    else:
        status = PhoneOtp.DispatchStatus.FAILED
        event_type = EmployerPhoneVerificationEvent.EventType.DISPATCH_FAILED
    challenge.dispatch_status = status
    challenge.dispatch_error_code = error.reason_code
    update_fields = ['dispatch_status', 'dispatch_error_code', 'updated_at']
    if status != PhoneOtp.DispatchStatus.RETRY_PENDING:
        challenge.otp_ciphertext = ''
        challenge.secret_purged_at = timezone.now()
        update_fields.extend(['otp_ciphertext', 'secret_purged_at'])
    challenge.save(update_fields=update_fields)
    _append_event(
        challenge,
        event_type,
        outcome=status,
        reason_code=error.reason_code,
    )
    record_metric(
        'employer_sms_dispatch',
        status=status,
        failure_code=error.reason_code,
        purpose=challenge.purpose,
    )
    return challenge


@transaction.atomic
def _mark_dispatch_sent(challenge_public_id, receipt):
    challenge = PhoneOtp.objects.select_for_update().get(public_id=challenge_public_id)
    if challenge.dispatch_status != PhoneOtp.DispatchStatus.DISPATCHING:
        return challenge
    now = timezone.now()
    challenge.dispatch_status = PhoneOtp.DispatchStatus.SENT
    challenge.dispatched_at = now
    challenge.provider_message_id = receipt.message_id[:255]
    challenge.dispatch_error_code = ''
    challenge.otp_ciphertext = ''
    challenge.secret_purged_at = now
    challenge.save(
        update_fields=[
            'dispatch_status',
            'dispatched_at',
            'provider_message_id',
            'dispatch_error_code',
            'otp_ciphertext',
            'secret_purged_at',
            'updated_at',
        ]
    )
    _append_event(
        challenge,
        EmployerPhoneVerificationEvent.EventType.DISPATCH_SENT,
        outcome='sent',
    )
    record_metric(
        'employer_sms_dispatch',
        status='sent',
        purpose=challenge.purpose,
    )
    return challenge


def dispatch_sms_phone_challenge(challenge_public_id, *, provider=None):
    """Dispatch exactly one claimed challenge with provider-side idempotency."""

    challenge = _claim_dispatch(challenge_public_id)
    if challenge is None:
        return None
    try:
        provider = provider or get_sms_provider()
        receipt = provider.send(
            SmsMessage(
                destination=_decrypt(challenge.destination_ciphertext),
                template_id=settings.EMPLOYER_SMS_TEMPLATE_ID,
                template_parameters={
                    'code': _decrypt(challenge.otp_ciphertext),
                    'ttl_minutes': str(int(SMS_OTP_TTL.total_seconds() // 60)),
                },
                sender=settings.EMPLOYER_SMS_SENDER,
                idempotency_key=challenge.public_id,
            )
        )
    except SmsProviderError as error:
        _mark_dispatch_error(challenge.public_id, error)
        raise
    return _mark_dispatch_sent(challenge.public_id, receipt)


@transaction.atomic
def mark_sms_dispatch_retries_exhausted(challenge_public_id):
    """Move a retryable challenge to a durable terminal state."""

    challenge = PhoneOtp.objects.select_for_update().filter(public_id=challenge_public_id).first()
    if challenge is None or challenge.dispatch_status != PhoneOtp.DispatchStatus.RETRY_PENDING:
        return challenge
    challenge.dispatch_status = PhoneOtp.DispatchStatus.FAILED
    challenge.dispatch_error_code = 'provider_retries_exhausted'
    challenge.otp_ciphertext = ''
    challenge.secret_purged_at = timezone.now()
    challenge.save(
        update_fields=[
            'dispatch_status',
            'dispatch_error_code',
            'otp_ciphertext',
            'secret_purged_at',
            'updated_at',
        ]
    )
    _append_event(
        challenge,
        EmployerPhoneVerificationEvent.EventType.DISPATCH_FAILED,
        outcome='failed',
        reason_code='provider_retries_exhausted',
    )
    record_metric(
        'employer_sms_dispatch',
        status='failed',
        failure_code='provider_retries_exhausted',
        purpose=challenge.purpose,
    )
    return challenge


@transaction.atomic
def recover_stale_sms_dispatches(*, limit=100):
    cutoff = timezone.now() - timedelta(seconds=settings.EMPLOYER_SMS_DISPATCH_STALE_SECONDS)
    stale = list(
        PhoneOtp.objects.select_for_update(skip_locked=True)
        .filter(
            dispatch_status=PhoneOtp.DispatchStatus.DISPATCHING,
            dispatch_started_at__lte=cutoff,
            invalidated_at__isnull=True,
            verified_at__isnull=True,
        )
        .order_by('dispatch_started_at')[:limit]
    )
    for challenge in stale:
        exhausted = challenge.dispatch_attempts >= SMS_MAX_DISPATCH_ATTEMPTS
        challenge.dispatch_status = (
            PhoneOtp.DispatchStatus.FAILED if exhausted else PhoneOtp.DispatchStatus.RETRY_PENDING
        )
        challenge.dispatch_error_code = (
            'dispatch_attempt_budget_exhausted' if exhausted else 'dispatch_stale'
        )
        update_fields = ['dispatch_status', 'dispatch_error_code', 'updated_at']
        if exhausted:
            challenge.otp_ciphertext = ''
            challenge.secret_purged_at = timezone.now()
            update_fields.extend(['otp_ciphertext', 'secret_purged_at'])
        challenge.save(update_fields=update_fields)
        _append_event(
            challenge,
            EmployerPhoneVerificationEvent.EventType.DISPATCH_FAILED
            if exhausted
            else EmployerPhoneVerificationEvent.EventType.STALE_RECOVERED,
            outcome='failed' if exhausted else 'retry_pending',
            reason_code=challenge.dispatch_error_code,
        )
    retry_ids = [
        challenge.public_id
        for challenge in stale
        if challenge.dispatch_status == PhoneOtp.DispatchStatus.RETRY_PENDING
    ]
    exhausted_count = len(stale) - len(retry_ids)
    if retry_ids:
        record_metric('employer_sms_recovery', value=len(retry_ids), status='recovered')
    if exhausted_count:
        record_metric(
            'employer_sms_recovery',
            value=exhausted_count,
            status='failed',
            failure_code='dispatch_attempt_budget_exhausted',
        )
    return retry_ids


@transaction.atomic
def purge_expired_sms_challenge_payloads(*, limit=500):
    cutoff = timezone.now() - timedelta(days=settings.EMPLOYER_SMS_CHALLENGE_RETENTION_DAYS)
    challenges = list(
        PhoneOtp.objects.select_for_update(skip_locked=True)
        .filter(created_at__lte=cutoff, pii_purged_at__isnull=True)
        .order_by('created_at')[:limit]
    )
    now = timezone.now()
    for challenge in challenges:
        challenge.phone = ''
        challenge.phone_fingerprint = ''
        challenge.destination_ciphertext = ''
        challenge.otp_ciphertext = ''
        challenge.code_hash = ''
        challenge.provider_message_id = ''
        challenge.pii_purged_at = now
        challenge.secret_purged_at = challenge.secret_purged_at or now
        challenge.dispatch_status = PhoneOtp.DispatchStatus.PURGED
        challenge.save(
            update_fields=[
                'phone',
                'phone_fingerprint',
                'destination_ciphertext',
                'otp_ciphertext',
                'code_hash',
                'provider_message_id',
                'pii_purged_at',
                'secret_purged_at',
                'dispatch_status',
                'updated_at',
            ]
        )
        _append_event(
            challenge,
            EmployerPhoneVerificationEvent.EventType.PAYLOAD_PURGED,
            outcome='purged',
        )
    if challenges:
        record_metric('employer_sms_retention', value=len(challenges), status='payload_purged')
    return len(challenges)


def purge_expired_phone_verification_events(*, limit=1000):
    cutoff = timezone.now() - timedelta(days=settings.EMPLOYER_SMS_EVENT_RETENTION_DAYS)
    event_ids = list(
        EmployerPhoneVerificationEvent.objects.filter(occurred_at__lte=cutoff)
        .order_by('occurred_at')
        .values_list('pk', flat=True)[:limit]
    )
    if not event_ids:
        return 0
    deleted, _ = EmployerPhoneVerificationEvent.objects.filter(pk__in=event_ids).delete()
    record_metric('employer_sms_retention', value=deleted, status='events_deleted')
    return deleted

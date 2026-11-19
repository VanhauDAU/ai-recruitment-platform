"""Recruiter-facing challenge flow: start, status and verification of a phone number."""

from __future__ import annotations

import secrets
from datetime import timedelta

from celery import current_app
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from common.db.public_id import generate_public_id

from ...models import EmployerPhoneVerificationEvent, PhoneOtp
from .crypto import (
    canonical_variants,
    challenge_code_matches,
    decrypt_payload,
    encrypt_payload,
    hash_challenge_code,
    normalize_vietnamese_mobile,
    phone_fingerprint,
)

SMS_OTP_TTL = timedelta(minutes=10)
SMS_OTP_COOLDOWN = timedelta(seconds=60)
SMS_MAX_VERIFY_ATTEMPTS = 5


class PhoneChallengeError(Exception):
    """Stable, presentation-neutral failure for the live SMS workflow."""

    def __init__(self, code, message, *, retryable=False, retry_after_seconds=None):
        self.code = code
        self.message = message
        self.retryable = retryable
        self.retry_after_seconds = retry_after_seconds
        super().__init__(code)


def append_event(challenge, event_type, *, outcome='', reason_code=''):
    return EmployerPhoneVerificationEvent.objects.create(
        user_id=challenge.user_id,
        challenge_public_id=challenge.public_id,
        purpose=challenge.purpose,
        event_type=event_type,
        outcome=outcome[:24],
        reason_code=reason_code[:50],
    )


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
    from ..profiles import get_or_create_recruiter

    recruiter = get_or_create_recruiter(locked_user)
    recruiter = recruiter.__class__.objects.select_for_update().get(pk=recruiter.pk)
    canonical_phone = normalize_vietnamese_mobile(phone)
    latest = PhoneOtp.objects.filter(user=locked_user).order_by('-created_at').first()
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

    canonical_phone = normalize_vietnamese_mobile(decrypt_payload(challenge.destination_ciphertext))
    from ...models import RecruiterProfile
    from ..profiles import get_or_create_recruiter

    recruiter = get_or_create_recruiter(locked_user)
    recruiter = RecruiterProfile.objects.select_for_update().get(pk=recruiter.pk)
    if (
        RecruiterProfile.objects.select_for_update()
        .filter(verified_phone__in=canonical_variants(canonical_phone))
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
    append_event(
        challenge,
        EmployerPhoneVerificationEvent.EventType.VERIFIED,
        outcome='verified',
    )
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

    if purpose not in PhoneOtp.Purpose.values:
        raise ValidationError('Mục đích xác minh số điện thoại không hợp lệ.')
    user.__class__.objects.select_for_update().only('pk').get(pk=user.pk)
    now = timezone.now()
    active = PhoneOtp.objects.select_for_update().filter(
        user=user,
        verified_at__isnull=True,
        invalidated_at__isnull=True,
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
        append_event(
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
        phone_fingerprint=phone_fingerprint(canonical_phone),
        destination_ciphertext=encrypt_payload(canonical_phone),
        otp_ciphertext=encrypt_payload(code),
        code_hash=hash_challenge_code(public_id, code),
        expires_at=now + SMS_OTP_TTL,
    )
    append_event(
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

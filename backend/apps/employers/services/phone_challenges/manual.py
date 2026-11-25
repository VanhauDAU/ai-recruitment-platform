"""Admin-attested phone verification while SMS OTP is switched off.

Production keeps ``EMPLOYER_SMS_OTP_ENABLED=False`` until an SMS provider is
approved (docs/06-deployment/nha-cung-cap-sms.md). Without SMS a recruiter can
never prove a phone, so the verification case can never be approved. An admin
who has confirmed the line out of band (a phone call) records that proof here.

The write mirrors a successful SMS challenge (contact, verified and login phone
become the same canonical number) so every gate keeps using
``RecruiterProfile.has_verified_phone``. It refuses to run once SMS is live:
then the recruiter proves the number themselves.
"""

from __future__ import annotations

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.accounts.services import record_admin_action

from ...models import EmployerPhoneVerificationEvent, RecruiterProfile
from .challenges import PhoneChallengeError, _challenge_purpose
from .crypto import canonical_variants, normalize_vietnamese_mobile

MANUAL_REASON_CODE = 'admin_attested'
AUDIT_ACTION = 'employer_phone_verified_by_admin'


@transaction.atomic
def verify_phone_by_admin(*, user, phone, reason, actor=None, actor_identifier=''):
    """Mark ``phone`` verified for the employer ``user`` on an admin's word.

    ``actor`` (an admin user) or ``actor_identifier`` (CLI identity) is stored in
    the admin audit log together with ``reason``; only the last 3 digits of the
    number go into the audit payload.
    """

    if settings.EMPLOYER_SMS_OTP_ENABLED:
        raise PhoneChallengeError(
            'PHONE_SMS_ENABLED',
            _('SMS đang bật: nhà tuyển dụng tự xác thực số điện thoại bằng mã OTP.'),
        )
    reason = (reason or '').strip()
    if not reason:
        raise PhoneChallengeError('PHONE_REASON_REQUIRED', _('Cần ghi lý do xác minh thủ công.'))

    canonical_phone = normalize_vietnamese_mobile(phone)
    locked_user = user.__class__.objects.select_for_update().get(pk=user.pk)
    recruiter, _created = RecruiterProfile.objects.get_or_create(user=locked_user)
    recruiter = RecruiterProfile.objects.select_for_update().get(pk=recruiter.pk)
    if (
        RecruiterProfile.objects.select_for_update()
        .filter(verified_phone__in=canonical_variants(canonical_phone))
        .exclude(user=locked_user)
        .exists()
    ):
        raise PhoneChallengeError(
            'PHONE_UNAVAILABLE',
            _('Số điện thoại này đã được nhà tuyển dụng khác xác thực.'),
        )

    purpose = _challenge_purpose(recruiter, canonical_phone)
    now = timezone.now()
    try:
        with transaction.atomic():
            recruiter.contact_phone = canonical_phone
            recruiter.verified_phone = canonical_phone
            recruiter.phone_verified_at = now
            recruiter.save(
                update_fields=['contact_phone', 'verified_phone', 'phone_verified_at', 'updated_at']
            )
    except IntegrityError as error:
        raise PhoneChallengeError(
            'PHONE_UNAVAILABLE',
            _('Số điện thoại này đã được nhà tuyển dụng khác xác thực.'),
        ) from error
    if locked_user.phone != canonical_phone:
        locked_user.phone = canonical_phone
        locked_user.save(update_fields=['phone', 'updated_at'])

    EmployerPhoneVerificationEvent.objects.create(
        user_id=locked_user.pk,
        purpose=purpose,
        event_type=EmployerPhoneVerificationEvent.EventType.VERIFIED,
        outcome='verified',
        reason_code=MANUAL_REASON_CODE,
    )
    record_admin_action(
        actor=actor,
        action=AUDIT_ACTION,
        target_type='recruiter',
        target_public_id=recruiter.public_id,
        payload={
            'user_public_id': locked_user.public_id,
            'phone_last3': canonical_phone[-3:],
            'purpose': purpose,
            'reason': reason[:200],
        },
        source='management_command',
        actor_identifier=actor_identifier,
    )
    return recruiter

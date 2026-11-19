"""Email verification workflows: resend the link, confirm a token, change an unverified email."""

from django.db import transaction
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework.exceptions import ValidationError

from ..models import AuthEmailJob, User
from . import email_verification
from .exceptions import VerificationCooldown
from .verification_delivery import queue_verification_email

_EMAIL_CHANGE_LOCKED = gettext_lazy('Tài khoản đã xác thực email; không thể đổi email tại đây.')


def resend_verification_email(user):
    """Queue a fresh verification link and return the new cooldown in seconds."""
    if user.email_verified:
        raise ValidationError({'detail': _('Email đã được xác thực.')})
    remaining = email_verification.cooldown_remaining(user)
    if remaining > 0:
        raise VerificationCooldown(remaining)
    queue_verification_email(user)
    return email_verification.cooldown_remaining(user)


def confirm_email_verification(token):
    """Consume a verification token and mark its account verified (idempotent)."""
    # Import lazily: task delivery imports account services to render email.
    from ..tasks import queue_welcome_email

    identity = email_verification.consume_token(token)
    if not isinstance(identity, dict):
        raise ValidationError({'detail': _('Liên kết xác thực không hợp lệ hoặc đã hết hạn.')})
    user = User.objects.filter(pk=identity.get('user_id'), is_deleted=False).first()
    if user is None:
        raise ValidationError({'detail': _('Không tìm thấy tài khoản.')})
    if not user.is_active or user.status != User.Status.ACTIVE:
        raise ValidationError(
            {
                'detail': (
                    _(
                        'Tài khoản đang bị hạn chế. Liên kết đã bị vô hiệu hóa; '
                        'vui lòng liên hệ bộ phận hỗ trợ.'
                    )
                )
            }
        )
    if User.objects.normalize_email(user.email) != identity.get('email'):
        raise ValidationError(
            {
                'detail': (
                    _(
                        'Địa chỉ email đã thay đổi sau khi liên kết này được gửi. '
                        'Vui lòng yêu cầu một email xác thực mới.'
                    )
                )
            }
        )
    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=['email_verified', 'updated_at'])
        queue_welcome_email(user, context={'registration_method': 'email'})
    return user


def ensure_email_change_allowed(user):
    # Chỉ dành cho tài khoản CHƯA xác thực (đúng mục đích thiết kế). Tài khoản
    # đã xác thực đổi email = đường cướp tài khoản, không mở ở đây.
    if user.email_verified:
        raise ValidationError({'detail': _EMAIL_CHANGE_LOCKED})


def change_unverified_email(user, email):
    """Replace the email of an unverified account and resend the verification link."""
    from ..tasks import queue_auth_email

    with transaction.atomic():
        user = User.objects.select_for_update().get(pk=user.pk)
        ensure_email_change_allowed(user)
        old_email = user.email
        user.email = email
        user.email_verified = False
        user.save(update_fields=['email', 'email_verified', 'updated_at'])

        # Cảnh báo địa chỉ cũ để chủ tài khoản thật phát hiện nếu bị chiếm phiên.
        queue_auth_email(
            AuthEmailJob.Kind.EMAIL_CHANGED_NOTICE,
            user,
            context={
                'recipient': old_email,
                'old_email': old_email,
                'new_email': user.email,
                'portal': user.role,
                'admin_initiated': False,
            },
        )
        queue_verification_email(user)
    return user

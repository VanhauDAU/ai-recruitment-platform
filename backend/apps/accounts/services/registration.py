"""Self-service account registration (candidate and employer portals)."""

from django.db import transaction

from apps.sitecontent.selectors import get_bool_setting

from ..models import User
from .exceptions import RegistrationClosed
from .verification_delivery import queue_verification_email

# Công tắc admin cho từng cổng (ADR-0026); áp cho form đăng ký và tài khoản
# tạo lần đầu qua mạng xã hội. Lời mời quản trị viên không đi qua đây.
REGISTRATION_SWITCHES = {
    User.Role.CANDIDATE: 'candidate_allow_registration',
    User.Role.EMPLOYER: 'employer_allow_registration',
}


def registration_open(role):
    key = REGISTRATION_SWITCHES.get(role)
    return key is None or get_bool_setting(key, True)


def ensure_registration_open(role):
    if not registration_open(role):
        raise RegistrationClosed()


@transaction.atomic
def register_account(*, email, password, role, **fields):
    """Create the portal account and queue its first verification email."""
    ensure_registration_open(role)
    user = User.objects.create_user(email=email, password=password, role=role, **fields)
    queue_verification_email(user)
    return user

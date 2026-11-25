"""Ẩn danh hóa tài khoản khi đáp ứng yêu cầu xóa của chủ thể dữ liệu."""

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from ..models import AuthEmailJob, SocialAccount, User
from .admin_account_common import cancel_pending_auth_email_jobs
from .tokens import revoke_refresh_tokens

ERASED_EMAIL_DOMAIN = 'deleted.invalid'


def erased_email(user):
    return f'deleted+{user.public_id.lower()}@{ERASED_EMAIL_DOMAIN}'


@transaction.atomic
def anonymize_account(user):
    """Xóa định danh của tài khoản nhưng giữ hàng ``User`` cho khóa ngoại.

    Hàng còn lại chỉ mang mã tài khoản, vai trò và mốc thời gian; mọi phiên
    đăng nhập bị thu hồi và tài khoản không đăng nhập lại được.
    """
    user = User.objects.select_for_update().get(pk=user.pk)
    revoke_refresh_tokens(user)
    SocialAccount.objects.filter(user=user).delete()
    cancel_pending_auth_email_jobs(
        AuthEmailJob.objects.select_for_update().filter(
            user=user, status=AuthEmailJob.Status.PENDING
        )
    )
    user.email = erased_email(user)
    user.full_name = ''
    user.phone = ''
    user.avatar_url = ''
    user.email_verified = False
    user.is_active = False
    user.is_deleted = True
    user.deleted_at = timezone.now()
    user.auth_revision = F('auth_revision') + 1
    user.set_unusable_password()
    user.save()
    user.refresh_from_db()
    return user

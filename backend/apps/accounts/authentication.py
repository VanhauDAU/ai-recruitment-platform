"""JWT adapters that enforce the accounts-domain access policy."""

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from .services.access import is_account_accessible
from .services.auth_sessions import active_session_for_access


class AccountJWTAuthentication(JWTAuthentication):
    """Reject tokens as soon as the account is disabled, deleted, or banned."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not is_account_accessible(user):
            raise AuthenticationFailed('Tài khoản không còn khả dụng.', code='user_inactive')
        auth_revision = validated_token.get('auth_rev', 1)
        if auth_revision != user.auth_revision:
            raise AuthenticationFailed(
                'Thông tin xác thực đã thay đổi. Vui lòng đăng nhập lại.',
                code='session_revoked',
            )
        if (
            active_session_for_access(
                sid=validated_token.get('sid'),
                user=user,
                auth_revision=auth_revision,
            )
            is None
        ):
            raise AuthenticationFailed(
                'Phiên đăng nhập đã hết hạn hoặc bị thu hồi.',
                code='session_revoked',
            )
        return user

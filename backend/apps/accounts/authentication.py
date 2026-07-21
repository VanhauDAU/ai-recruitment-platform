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
        if user.is_admin_role and not user.two_factor_enabled:
            raise AuthenticationFailed(
                'Tài khoản quản trị bắt buộc bật MFA.',
                code='admin_mfa_required',
            )
        if active_session_for_access(sid=validated_token.get('sid'), user=user) is None:
            raise AuthenticationFailed(
                'Phiên đăng nhập đã hết hạn hoặc bị thu hồi.',
                code='session_revoked',
            )
        return user

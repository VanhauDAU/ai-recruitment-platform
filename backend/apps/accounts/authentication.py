"""JWT adapters that enforce the accounts-domain access policy."""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .services.access import is_account_accessible


class AccountJWTAuthentication(JWTAuthentication):
    """Reject tokens as soon as the account is disabled, deleted, or banned."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not is_account_accessible(user):
            raise AuthenticationFailed('Tài khoản không còn khả dụng.', code='user_inactive')
        return user


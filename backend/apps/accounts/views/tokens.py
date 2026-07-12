"""JWT refresh adapter for the accounts-domain access policy."""

from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from ..selectors import get_accessible_user


class AccountTokenRefreshSerializer(TokenRefreshSerializer):
    default_error_messages = {
        **TokenRefreshSerializer.default_error_messages,
        'user_inactive': 'Tài khoản không còn khả dụng.',
    }

    def validate(self, attrs):
        refresh = RefreshToken(attrs['refresh'])
        if not get_accessible_user(refresh.get(api_settings.USER_ID_CLAIM)):
            raise InvalidToken({'detail': self.error_messages['user_inactive']})
        return super().validate(attrs)


class AccountTokenRefreshView(TokenRefreshView):
    serializer_class = AccountTokenRefreshSerializer

"""JWT refresh adapter for the accounts-domain access policy."""

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from ...selectors import get_accessible_user
from ...services import auth_sessions
from ...services.refresh_cookies import (
    VALID_PORTALS,
    clear_refresh_cookie,
    portal_for_user,
    refresh_from_request,
    set_refresh_cookie,
)


class AccountTokenRefreshSerializer(TokenRefreshSerializer):
    default_error_messages = {
        **TokenRefreshSerializer.default_error_messages,
        'user_inactive': 'Tài khoản không còn khả dụng.',
    }

    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs['refresh'])
        except TokenError:
            # Chữ ký còn hợp lệ và chưa hết hạn mà vẫn bị từ chối nghĩa là token
            # đã bị blacklist khi xoay vòng — tức có người phát lại bản cũ.
            auth_sessions.revoke_reused_refresh(attrs['refresh'])
            raise
        user = get_accessible_user(refresh.get(api_settings.USER_ID_CLAIM))
        if not user:
            raise InvalidToken({'detail': self.error_messages['user_inactive']})
        expected_portal = self.context.get('portal')
        if expected_portal and portal_for_user(user) != expected_portal:
            raise InvalidToken({'detail': 'Refresh token không thuộc cổng này.'})
        auth_revision = refresh.get(auth_sessions.AUTH_REVISION_CLAIM, 1)
        if auth_revision != user.auth_revision:
            raise InvalidToken({'detail': 'Phiên đăng nhập đã bị thu hồi.'})
        old_jti = refresh.get(api_settings.JTI_CLAIM)
        with transaction.atomic():
            session = auth_sessions.locked_refresh_session(
                sid=refresh.get(auth_sessions.SID_CLAIM),
                user_id=user.pk,
                refresh_jti=old_jti,
                auth_revision=auth_revision,
            )
            if session is not None:
                # The row lock serializes concurrent rotation of one refresh token.
                # The second request observes the old jti no longer attached to a
                # live session and is rejected instead of creating a second branch.
                data = super().validate(attrs)
                if data.get('refresh'):
                    auth_sessions.rotate_session(session, data['refresh'])

        if session is None:
            # Thu hồi PHẢI nằm ngoài atomic ở trên, nếu không exception bên dưới
            # sẽ rollback luôn chính việc thu hồi.
            auth_sessions.revoke_reused_refresh(attrs['refresh'])
            raise InvalidToken({'detail': 'Phiên đăng nhập đã hết hạn hoặc bị thu hồi.'})

        if user.is_admin_role and data.get('access'):
            access = AccessToken(data['access'])
            access.set_exp(lifetime=timedelta(minutes=settings.ADMIN_ACCESS_TOKEN_MINUTES))
            data['access'] = str(access)
        data['user'] = user
        return data


class AccountTokenRefreshView(TokenRefreshView):
    serializer_class = AccountTokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        portal = request.data.get('portal') or request.headers.get('X-Auth-Portal')
        is_session_probe = request.headers.get('X-Session-Probe') == '1'
        if portal not in VALID_PORTALS:
            return Response(
                {'portal': 'Cổng đăng nhập không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST
            )
        refresh = refresh_from_request(request, portal=portal)
        if not refresh:
            response = Response(
                None if is_session_probe else {'detail': 'Không tìm thấy phiên làm mới.'},
                status=(
                    status.HTTP_204_NO_CONTENT if is_session_probe else status.HTTP_401_UNAUTHORIZED
                ),
            )
            return clear_refresh_cookie(response, portal=portal)

        serializer = self.serializer_class(data={'refresh': refresh}, context={'portal': portal})
        try:
            serializer.is_valid(raise_exception=True)
        except (InvalidToken, TokenError):
            response = Response(
                (
                    None
                    if is_session_probe
                    else {'detail': 'Phiên làm mới không hợp lệ hoặc đã hết hạn.'}
                ),
                status=(
                    status.HTTP_204_NO_CONTENT if is_session_probe else status.HTTP_401_UNAUTHORIZED
                ),
            )
            return clear_refresh_cookie(response, portal=portal)

        data = dict(serializer.validated_data)
        user = data.pop('user')
        rotated_refresh = data.pop('refresh', None)
        response = Response(data, status=status.HTTP_200_OK)
        if rotated_refresh:
            set_refresh_cookie(response, rotated_refresh, user=user)
        return response

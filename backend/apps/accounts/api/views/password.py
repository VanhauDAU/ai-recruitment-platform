"""Authenticated password setup/change workflow."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from ...services import auth_sessions
from ...services.refresh_cookies import refresh_from_request, set_refresh_cookie
from ...services.tokens import issue_tokens, revoke_refresh_tokens
from ..serializers import PasswordChangeSerializer, SessionUserSerializer


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Đặt hoặc thay đổi mật khẩu của tài khoản đang đăng nhập',
        request=PasswordChangeSerializer,
        responses=inline_serializer(
            'PasswordChangeResponse',
            fields={
                'detail': serializers.CharField(),
                'user': SessionUserSerializer(),
                'tokens': inline_serializer(
                    'PasswordChangeTokens',
                    {
                        'access': serializers.CharField(),
                    },
                ),
            },
        ),
        tags=['auth'],
    )
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        refresh_string = refresh_from_request(request, user=user)
        current_sid = request.auth.get(auth_sessions.SID_CLAIM) if request.auth else None
        try:
            refresh = RefreshToken(refresh_string) if refresh_string else None
            refresh_sid = refresh.get(auth_sessions.SID_CLAIM) if refresh else None
            refresh_user_id = refresh.get(api_settings.USER_ID_CLAIM) if refresh else None
            session = (
                auth_sessions.active_sessions(user)
                .filter(
                    id=current_sid,
                    refresh_jti=refresh.get(api_settings.JTI_CLAIM) if refresh else '',
                )
                .first()
            )
        except TokenError:
            refresh = None
            refresh_sid = None
            refresh_user_id = None
            session = None

        if session is None or refresh_sid != current_sid or str(refresh_user_id) != str(user.pk):
            return Response(
                {'detail': 'Cần phiên refresh hiện tại để đổi mật khẩu.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.has_usable_password() and not auth_sessions.is_recent_oauth_reauthentication(
            session
        ):
            return Response(
                {
                    'detail': 'Hãy đăng nhập lại với OAuth trước khi tạo mật khẩu.',
                    'code': 'reauth_required',
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        user.set_password(serializer.validated_data['password'])
        user.save(update_fields=['password', 'updated_at'])

        # Đổi mật khẩu là thao tác nhạy cảm: luôn rotate phiên hiện tại (OWASP —
        # thay session identifier sau thay đổi nhạy cảm) và cấp cặp token mới để
        # thiết bị hiện tại không bị văng giữa luồng (vd onboarding NTD).
        if serializer.validated_data['logout_all_sessions']:
            # Đăng xuất mọi thiết bị khác: thu hồi toàn bộ refresh token cũ...
            revoke_refresh_tokens(user)
        else:
            # ...ngược lại thu hồi chính phiên cũ; access token của phiên đó bị
            # middleware chặn ngay nhờ `sid`, không phải chờ JWT hết hạn.
            auth_sessions.revoke_session(session)

        tokens = issue_tokens(user, request, auth_method='password')
        response = Response(
            {
                'detail': 'Cập nhật mật khẩu thành công.',
                'user': SessionUserSerializer(user, context={'request': request}).data,
                'tokens': {'access': tokens['access']},
            }
        )
        return set_refresh_cookie(response, tokens['refresh'], user=user)

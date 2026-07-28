"""Authenticated password setup/change workflow."""

from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ...selectors import linked_oauth_provider
from ...services import auth_sessions, record_admin_self_action
from ...services.refresh_cookies import set_refresh_cookie
from ...services.tokens import issue_tokens, revoke_refresh_tokens
from ..serializers import PasswordChangeSerializer, SessionUserSerializer


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Điều kiện cần để đặt hoặc thay đổi mật khẩu ở phiên hiện tại',
        description=(
            'Cho phép client hiển thị yêu cầu xác thực lại TRƯỚC khi người dùng '
            'điền form, thay vì để họ nhận 403 sau khi bấm lưu.'
        ),
        responses=inline_serializer(
            'PasswordSetupRequirements',
            fields={
                'has_usable_password': serializers.BooleanField(),
                'requires_reauth': serializers.BooleanField(),
                'reauth_provider': serializers.CharField(allow_null=True),
                'reauth_max_age_seconds': serializers.IntegerField(),
            },
        ),
        tags=['auth'],
    )
    def get(self, request):
        user = request.user
        session = auth_sessions.current_session(request, user)
        requires_reauth = auth_sessions.requires_oauth_reauthentication(user, session)
        return Response(
            {
                'has_usable_password': user.has_usable_password(),
                'requires_reauth': requires_reauth,
                'reauth_provider': linked_oauth_provider(user) if requires_reauth else None,
                'reauth_max_age_seconds': settings.AUTH_REAUTH_MAX_AGE_SECONDS,
            }
        )

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
        session = auth_sessions.current_session(request, user)
        if session is None:
            return Response(
                {'detail': 'Cần phiên refresh hiện tại để đổi mật khẩu.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if auth_sessions.requires_oauth_reauthentication(user, session):
            return Response(
                {
                    'detail': 'Hãy xác thực lại bằng mạng xã hội trước khi tạo mật khẩu.',
                    'code': 'reauth_required',
                    'reauth_provider': linked_oauth_provider(user),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        user.set_password(serializer.validated_data['password'])
        user.save(update_fields=['password', 'updated_at'])
        record_admin_self_action(
            user,
            'self_password_change',
            {'logout_all_sessions': serializer.validated_data['logout_all_sessions']},
        )

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

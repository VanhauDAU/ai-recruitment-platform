"""Authenticated password setup/change workflow."""

from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from ...selectors import linked_oauth_provider
from ...services import auth_sessions
from ...services.exceptions import OAuthReauthRequired
from ...services.password import change_password
from ...services.refresh_cookies import set_refresh_cookie
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
            raise ValidationError({'detail': 'Cần phiên refresh hiện tại để đổi mật khẩu.'})
        if auth_sessions.requires_oauth_reauthentication(user, session):
            raise OAuthReauthRequired(linked_oauth_provider(user))

        tokens = change_password(
            user,
            session,
            request,
            password=serializer.validated_data['password'],
            logout_all_sessions=serializer.validated_data['logout_all_sessions'],
        )
        response = Response(
            {
                'detail': 'Cập nhật mật khẩu thành công.',
                'user': SessionUserSerializer(user, context={'request': request}).data,
                'tokens': {'access': tokens['access']},
            }
        )
        return set_refresh_cookie(response, tokens['refresh'], user=user)

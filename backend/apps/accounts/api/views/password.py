"""Authenticated password setup/change workflow."""

from django.conf import settings
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ...services import auth_sessions, password_setup_code
from ...services.password import change_password
from ...services.refresh_cookies import set_refresh_cookie
from ..serializers import PasswordChangeSerializer, SessionUserSerializer


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    # current_password là một lần đoán mật khẩu: token access bị lộ không được
    # dùng để dò mật khẩu không giới hạn.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_change'

    @extend_schema(
        summary='Điều kiện cần để đặt hoặc thay đổi mật khẩu ở phiên hiện tại',
        description=(
            'Tài khoản chưa có mật khẩu (đăng nhập mạng xã hội) phải nhập mã gửi '
            'qua email; client biết trước để hiện ô nhập mã thay vì nhận lỗi sau khi lưu.'
        ),
        responses=inline_serializer(
            'PasswordSetupRequirements',
            fields={
                'has_usable_password': serializers.BooleanField(),
                'requires_email_code': serializers.BooleanField(),
                'email_code_ttl_seconds': serializers.IntegerField(),
                'resend_after_seconds': serializers.IntegerField(),
            },
        ),
        tags=['auth'],
    )
    def get(self, request):
        user = request.user
        has_password = user.has_usable_password()
        return Response(
            {
                'has_usable_password': has_password,
                'requires_email_code': not has_password,
                'email_code_ttl_seconds': settings.PASSWORD_SETUP_CODE_TTL,
                'resend_after_seconds': 0
                if has_password
                else password_setup_code.cooldown_remaining(user),
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
            raise ValidationError({'detail': _('Cần phiên refresh hiện tại để đổi mật khẩu.')})
        tokens = change_password(
            user,
            session,
            request,
            password=serializer.validated_data['password'],
            logout_all_sessions=serializer.validated_data['logout_all_sessions'],
        )
        response = Response(
            {
                'detail': _('Cập nhật mật khẩu thành công.'),
                'user': SessionUserSerializer(user, context={'request': request}).data,
                'tokens': {'access': tokens['access']},
            }
        )
        return set_refresh_cookie(response, tokens['refresh'], user=user)


class PasswordSetupCodeView(APIView):
    """Gửi mã xác minh qua email để tài khoản chưa có mật khẩu tạo mật khẩu."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_setup_code'

    @extend_schema(
        summary='Gửi mã xác minh tạo mật khẩu tới email tài khoản',
        request=None,
        responses=inline_serializer(
            'PasswordSetupCodeResponse',
            fields={
                'detail': serializers.CharField(),
                'resend_after_seconds': serializers.IntegerField(),
            },
        ),
        tags=['auth'],
    )
    def post(self, request):
        user = request.user
        if user.has_usable_password():
            raise ValidationError(
                {'detail': _('Tài khoản đã có mật khẩu, hãy dùng mật khẩu hiện tại.')}
            )
        resend_after = password_setup_code.request_code(user)
        return Response(
            {
                'detail': _('Đã gửi mã xác minh tới %(email)s.') % {'email': user.email},
                'resend_after_seconds': resend_after,
            }
        )

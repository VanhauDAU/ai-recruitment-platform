"""Đặt lại mật khẩu qua link email — workflow ở services/password_reset.py."""

from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from common.api.throttling import ClientIPScopedRateThrottle, with_account_write_cap

from ...services import password_reset as pr
from ...services import verify_request_captcha
from ..serializers import PasswordResetConfirmSerializer, PasswordResetRequestSerializer

# Trả về cho MỌI email (tồn tại hay không) để không biến endpoint này thành công
# cụ dò xem địa chỉ nào đã đăng ký.
_RESET_SENT_DETAIL = gettext_lazy(
    'Nếu email này đã đăng ký tài khoản, chúng tôi đã gửi liên kết đặt lại mật khẩu. '
    'Vui lòng kiểm tra hòm thư (kể cả mục Spam).'
)


@extend_schema(
    summary='Gửi email chứa link đặt lại mật khẩu',
    request=PasswordResetRequestSerializer,
    responses={200: inline_serializer('PasswordResetRequest', {'detail': serializers.CharField()})},
    tags=['auth'],
)
class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = with_account_write_cap(ClientIPScopedRateThrottle)
    throttle_scope = 'password_reset'

    def post(self, request):
        verify_request_captcha(request, 'password_reset')
        serializer = PasswordResetRequestSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        pr.request_password_reset(
            serializer.validated_data['email'],
            serializer.validated_data.get('portal') or 'main',
        )
        return Response({'detail': _RESET_SENT_DETAIL})


@extend_schema(
    summary='Kiểm tra link đặt lại mật khẩu còn hiệu lực (không tiêu token)',
    responses={
        200: inline_serializer(
            'PasswordResetValidate',
            {
                'email': serializers.EmailField(),
                'role': serializers.CharField(),
            },
        )
    },
    tags=['auth'],
)
class PasswordResetValidateView(APIView):
    """Cho frontend biết nên hiện form đổi mật khẩu hay màn 'link đã hết hạn'."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'password_reset_validate'

    def get(self, request):
        user = pr.validate_reset_token(
            request.query_params.get('token'),
            request.query_params.get('portal'),
        )
        return Response({'email': user.email, 'role': user.role})


@extend_schema(
    summary='Đặt mật khẩu mới bằng token trong link',
    request=PasswordResetConfirmSerializer,
    responses={
        200: inline_serializer(
            'PasswordResetConfirm',
            {
                'detail': serializers.CharField(),
                'role': serializers.CharField(),
            },
        )
    },
    tags=['auth'],
)
class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = with_account_write_cap(ClientIPScopedRateThrottle)
    throttle_scope = 'password_reset_confirm'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        # Validate mật khẩu TRƯỚC khi tiêu token: mật khẩu yếu không được đốt link.
        serializer.is_valid(raise_exception=True)

        user = pr.reset_password(
            serializer.validated_data['token'],
            serializer.validated_data['password'],
            serializer.validated_data.get('portal'),
        )
        return Response({'detail': _('Đặt lại mật khẩu thành công.'), 'role': user.role})

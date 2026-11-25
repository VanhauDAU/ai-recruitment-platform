"""Xác thực email: gửi/xác nhận link, đổi email — workflow ở services/."""

from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from common.api.throttling import ClientIPScopedRateThrottle, with_account_write_cap

from ...services.verification import (
    change_unverified_email,
    confirm_email_verification,
    ensure_email_change_allowed,
    resend_verification_email,
)
from ..serializers import ChangeEmailSerializer, SessionUserSerializer


@extend_schema(
    summary='Gửi lại email xác thực cho tài khoản hiện tại',
    request=None,
    responses={
        200: inline_serializer(
            'VerifyResend',
            {'detail': serializers.CharField(), 'retry_after': serializers.IntegerField()},
        )
    },
    tags=['auth'],
)
class VerificationSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = with_account_write_cap(ClientIPScopedRateThrottle)
    throttle_scope = 'verify_email'

    def post(self, request):
        retry_after = resend_verification_email(request.user)
        return Response(
            {
                'detail': _('Email xác thực đang được gửi. Vui lòng kiểm tra hòm thư sau ít phút.'),
                'retry_after': retry_after,
            }
        )


@extend_schema(
    summary='Xác nhận email bằng token trong link',
    request=inline_serializer('VerifyConfirmRequest', {'token': serializers.CharField()}),
    responses={200: inline_serializer('VerifyConfirm', {'detail': serializers.CharField()})},
    tags=['auth'],
)
class VerificationConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = with_account_write_cap(ClientIPScopedRateThrottle)
    throttle_scope = 'verify_email_confirm'

    def post(self, request):
        confirm_email_verification(request.data.get('token'))
        return Response({'detail': _('Xác thực email thành công.')})


@extend_schema(
    summary='Đổi địa chỉ email (reset xác thực và gửi lại link)',
    request=ChangeEmailSerializer,
    responses={200: SessionUserSerializer},
    tags=['auth'],
)
class ChangeEmailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = with_account_write_cap(ClientIPScopedRateThrottle)
    throttle_scope = 'change_email'

    def post(self, request):
        # Kiểm tra trước khi validate: tài khoản đã xác thực không được thấy lỗi
        # nhập liệu (mật khẩu hiện tại, email trùng) của một luồng không dành cho nó.
        ensure_email_change_allowed(request.user)
        serializer = ChangeEmailSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = change_unverified_email(request.user, serializer.validated_data['email'])
        return Response(SessionUserSerializer(user).data)

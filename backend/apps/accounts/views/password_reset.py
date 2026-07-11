"""Đặt lại mật khẩu qua link email — logic token/cooldown ở ../password_reset.py."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .. import password_reset as pr
from ..models import AuthEmailJob, User
from ..serializers import PasswordResetConfirmSerializer, PasswordResetRequestSerializer
from ..tasks import queue_auth_email
from .tokens import revoke_refresh_tokens

# Trả về cho MỌI email (tồn tại hay không) để không biến endpoint này thành công
# cụ dò xem địa chỉ nào đã đăng ký.
_RESET_SENT_DETAIL = (
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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = User.objects.filter(
            email__iexact=serializer.validated_data['email'],
            is_deleted=False,
            status=User.Status.ACTIVE,
        ).first()

        # Cooldown im lặng: phản hồi phải giống hệt nhau dù email có tồn tại hay
        # không, nếu không attacker vẫn phân biệt được qua status code/thời gian.
        # Token được sinh trong worker (lúc gửi thật), xem tasks._send.
        if user and pr.cooldown_remaining(user) == 0:
            pr.start_cooldown(user)
            queue_auth_email(AuthEmailJob.Kind.PASSWORD_RESET, user)

        return Response({'detail': _RESET_SENT_DETAIL})


@extend_schema(
    summary='Kiểm tra link đặt lại mật khẩu còn hiệu lực (không tiêu token)',
    responses={200: inline_serializer('PasswordResetValidate', {
        'email': serializers.EmailField(), 'role': serializers.CharField(),
    })},
    tags=['auth'],
)
class PasswordResetValidateView(APIView):
    """Cho frontend biết nên hiện form đổi mật khẩu hay màn 'link đã hết hạn'."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user_id = pr.peek_token(request.query_params.get('token'))
        user = User.objects.filter(pk=user_id, is_deleted=False).first() if user_id else None
        if user is None:
            return Response(
                {'detail': 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({'email': user.email, 'role': user.role})


@extend_schema(
    summary='Đặt mật khẩu mới bằng token trong link',
    request=PasswordResetConfirmSerializer,
    responses={200: inline_serializer('PasswordResetConfirm', {
        'detail': serializers.CharField(), 'role': serializers.CharField(),
    })},
    tags=['auth'],
)
class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset_confirm'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        # Validate mật khẩu TRƯỚC khi tiêu token: mật khẩu yếu không được đốt link.
        serializer.is_valid(raise_exception=True)

        user_id = pr.consume_token(serializer.validated_data['token'])
        user = User.objects.filter(pk=user_id, is_deleted=False).first() if user_id else None
        if user is None:
            return Response(
                {'detail': 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data['password'])
        fields = ['password', 'updated_at']
        # Nhận được mail ở địa chỉ này = đã chứng minh quyền sở hữu hòm thư.
        if not user.email_verified:
            user.email_verified = True
            fields.append('email_verified')
        user.save(update_fields=fields)
        revoke_refresh_tokens(user)

        return Response({'detail': 'Đặt lại mật khẩu thành công.', 'role': user.role})

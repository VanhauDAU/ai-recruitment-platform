"""Xác thực email: gửi/xác nhận link, đổi email — workflow ở services/."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..models import AuthEmailJob, User
from ..serializers import ChangeEmailSerializer, UserSerializer
from ..services import email_verification as ev
from ..tasks import queue_auth_email


def queue_verification_email(user):
    """Queue email xác thực sau khi request hoàn tất; không chờ SMTP."""
    ev.start_cooldown(user)
    return queue_auth_email(AuthEmailJob.Kind.VERIFICATION, user)


@extend_schema(
    summary='Gửi lại email xác thực cho tài khoản hiện tại',
    request=None,
    responses={200: inline_serializer('VerifyResend', {'detail': serializers.CharField(), 'retry_after': serializers.IntegerField()})},
    tags=['auth'],
)
class VerificationSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'verify_email'

    def post(self, request):
        user = request.user
        if user.email_verified:
            return Response({'detail': 'Email đã được xác thực.'}, status=status.HTTP_400_BAD_REQUEST)

        remaining = ev.cooldown_remaining(user)
        if remaining > 0:
            return Response(
                {'detail': f'Vui lòng chờ {remaining}s trước khi gửi lại.', 'retry_after': remaining},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        queue_verification_email(user)
        return Response({
            'detail': 'Email xác thực đang được gửi. Vui lòng kiểm tra hòm thư sau ít phút.',
            'retry_after': ev.cooldown_remaining(user),
        })


@extend_schema(
    summary='Xác nhận email bằng token trong link',
    request=inline_serializer('VerifyConfirmRequest', {'token': serializers.CharField()}),
    responses={200: inline_serializer('VerifyConfirm', {'detail': serializers.CharField()})},
    tags=['auth'],
)
class VerificationConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user_id = ev.consume_token(request.data.get('token'))
        if user_id is None:
            return Response(
                {'detail': 'Liên kết xác thực không hợp lệ hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = User.objects.filter(pk=user_id, is_deleted=False).first()
        if user is None:
            return Response({'detail': 'Không tìm thấy tài khoản.'}, status=status.HTTP_400_BAD_REQUEST)
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=['email_verified', 'updated_at'])
        return Response({'detail': 'Xác thực email thành công.'})


@extend_schema(
    summary='Đổi địa chỉ email (reset xác thực và gửi lại link)',
    request=ChangeEmailSerializer,
    responses={200: UserSerializer},
    tags=['auth'],
)
class ChangeEmailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangeEmailSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.email = serializer.validated_data['email']
        user.email_verified = False
        user.save(update_fields=['email', 'email_verified', 'updated_at'])

        queue_verification_email(user)
        return Response(UserSerializer(user).data)

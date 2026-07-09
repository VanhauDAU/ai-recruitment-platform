import logging

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.common.media_storage import delete_local_media_url, save_image_upload

from . import email_verification as ev
from .models import User
from .serializers import (
    ChangeEmailSerializer,
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


def _issue_tokens(user):
    """Trả về access/refresh JWT (kèm claim role/email) cho `user`."""
    refresh = RoleTokenObtainPairSerializer.get_token(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def _safe_send_verification(user):
    """Gửi email xác thực + bật cooldown, nuốt lỗi để không chặn luồng chính."""
    try:
        ev.send_verification_email(user)
        ev.start_cooldown(user)
    except Exception:  # noqa: BLE001 — email hỏng không được làm hỏng đăng ký
        logger.exception('Gửi email xác thực thất bại cho %s', user.email)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        _safe_send_verification(user)
        return Response(
            {'user': UserSerializer(user).data, **_issue_tokens(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = RoleTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class AvatarUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser]

    @extend_schema(
        summary='Upload avatar người dùng vào storage nội bộ',
        request=inline_serializer(
            'AvatarUploadRequest',
            fields={'file': serializers.FileField(help_text='Ảnh JPG, PNG, GIF hoặc WebP, tối đa 5MB')},
        ),
        responses={200: UserSerializer},
        tags=['auth'],
    )
    def post(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'file': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        old_url = user.avatar_url
        saved = save_image_upload(upload, f'users/avatars/{user.public_id}', request=request)

        user.avatar_url = saved['url']
        user.save(update_fields=['avatar_url', 'updated_at'])
        delete_local_media_url(old_url)

        return Response(UserSerializer(user).data)


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

        ev.send_verification_email(user)
        ev.start_cooldown(user)
        return Response({
            'detail': 'Đã gửi email xác thực. Vui lòng kiểm tra hòm thư.',
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
        user = User.objects.filter(pk=user_id).first()
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

        _safe_send_verification(user)
        return Response(UserSerializer(user).data)

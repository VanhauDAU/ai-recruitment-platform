"""Auth lõi: đăng ký, đăng nhập, thông tin tài khoản, avatar."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from common.media_storage import delete_local_media_url, save_image_upload

from ..models import User
from ..serializers import RegisterSerializer, RoleTokenObtainPairSerializer, UserSerializer
from ..services import verify_request_captcha
from ..services.tokens import issue_tokens
from .verification import queue_verification_email


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verify_request_captcha(request, 'register')
        user = serializer.save()
        queue_verification_email(user)
        return Response(
            {'user': UserSerializer(user).data, **issue_tokens(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = RoleTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        verify_request_captcha(request, 'login')
        return super().post(request, *args, **kwargs)


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

        # Database chỉ lưu storage key; serializer sẽ resolve URL theo domain/CDN
        # hiện tại khi trả API.
        user.avatar_url = saved['path']
        user.save(update_fields=['avatar_url', 'updated_at'])
        delete_local_media_url(old_url)

        return Response(UserSerializer(user).data)

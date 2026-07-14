"""Auth lõi: đăng ký, đăng nhập, thông tin tài khoản, avatar."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from common.media_storage import delete_local_media_url, save_image_upload

from ..models import AuthEmailJob, User
from ..serializers import (
    LoginCredentialsSerializer,
    ProfileUpdateSerializer,
    RegisterEmailAvailabilitySerializer,
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    UserSerializer,
)
from ..services import verify_request_captcha
from ..services.tokens import issue_tokens
from ..services import two_factor
from ..tasks import queue_auth_email
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


@extend_schema(
    summary='Kiểm tra email có thể dùng để đăng ký',
    request=RegisterEmailAvailabilitySerializer,
    responses=inline_serializer(
        'RegisterEmailAvailability',
        fields={'available': serializers.BooleanField()},
    ),
    tags=['auth'],
)
class RegisterEmailAvailabilityView(APIView):
    """Rate-limited UX pre-check; RegisterSerializer remains the final authority."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register_email_check'

    def post(self, request):
        serializer = RegisterEmailAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        exists = User.objects.filter(email__iexact=serializer.validated_data['email']).exists()
        return Response({'available': not exists})


class LoginView(APIView):
    serializer_class = LoginCredentialsSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        verify_request_captcha(request, 'login')
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        if user.two_factor_enabled:
            challenge = two_factor.start_login_challenge(user, serializer.portal)
            queue_auth_email(AuthEmailJob.Kind.TWO_FACTOR, user, context={'purpose': two_factor.PURPOSE_LOGIN})
            return Response(
                {
                    'two_factor_required': True,
                    'challenge': challenge,
                    'email': user.email,
                    'expires_in': two_factor.code_remaining(user, two_factor.PURPOSE_LOGIN),
                },
                status=status.HTTP_202_ACCEPTED,
            )
        return Response(issue_tokens(user))


class MeView(generics.RetrieveUpdateAPIView):
    """GET: thông tin tài khoản hiện tại. PATCH: cập nhật họ tên + SĐT.

    Chỉ nhận PATCH (không PUT) vì chỉ sửa một phần hồ sơ; email không đổi ở đây.
    """

    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch']

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        return ProfileUpdateSerializer if self.request.method == 'PATCH' else UserSerializer

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # Trả về UserSerializer đầy đủ để frontend cập nhật thẳng auth context.
        return Response(UserSerializer(request.user, context=self.get_serializer_context()).data)


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

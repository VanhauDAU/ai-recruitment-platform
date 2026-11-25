"""Auth lõi: đăng ký, đăng nhập, thông tin tài khoản, avatar."""

from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import generics, parsers, permissions, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from common.api.throttling import (
    ClientIPScopedRateThrottle,
    WriteScopedRateThrottle,
    with_account_write_cap,
    with_default_throttles,
)

from ...models import User
from ...services import cf_access, verify_request_captcha
from ...services.profile import remove_avatar, replace_avatar, update_own_profile
from ...services.refresh_cookies import set_refresh_cookie
from ...services.registration import register_account
from ...services.tokens import issue_tokens
from ..serializers import (
    LoginCredentialsSerializer,
    ProfileUpdateSerializer,
    RegisterEmailAvailabilitySerializer,
    RegisterSerializer,
    SessionUserSerializer,
)


@extend_schema(
    summary='Đăng ký tài khoản ứng viên hoặc NTD',
    request=RegisterSerializer,
    responses={
        201: inline_serializer(
            'RegisterResult',
            fields={'user': SessionUserSerializer(), 'access': serializers.CharField()},
        )
    },
    tags=['auth'],
)
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = with_account_write_cap(ClientIPScopedRateThrottle)
    throttle_scope = 'register'

    def create(self, request, *args, **kwargs):
        # Captcha trước validate: xem ghi chú ở EmployerRegisterView — thông báo
        # "email đã được sử dụng" là oracle dò tài khoản nếu trả lời trước captcha.
        verify_request_captcha(request, 'register')
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        data.pop('captcha_token', None)
        user = register_account(**data)
        tokens = issue_tokens(user, request, auth_method='registration')
        response = Response(
            {
                'user': SessionUserSerializer(user, context={'request': request}).data,
                'access': tokens['access'],
            },
            status=status.HTTP_201_CREATED,
        )
        return set_refresh_cookie(response, tokens['refresh'], user=user)


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
    throttle_classes = with_account_write_cap(ClientIPScopedRateThrottle)
    throttle_scope = 'register_email_check'

    def post(self, request):
        serializer = RegisterEmailAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        exists = User.objects.email_claimed_for_role(
            serializer.validated_data['email'],
            serializer.validated_data['role'],
        )
        return Response({'available': not exists})


@extend_schema(
    summary='Đăng nhập theo cổng (ứng viên / NTD / admin)',
    request=LoginCredentialsSerializer,
    responses={
        200: inline_serializer(
            'LoginResult',
            fields={
                'user': SessionUserSerializer(required=False),
                'access': serializers.CharField(required=False),
                'detail': serializers.CharField(required=False),
                'code': serializers.CharField(required=False),
            },
        )
    },
    tags=['auth'],
)
class LoginView(APIView):
    serializer_class = LoginCredentialsSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = with_account_write_cap(ClientIPScopedRateThrottle)
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        if request.data.get('portal') == 'admin':
            # Chặn trước khi thử mật khẩu: ngoài Access không dò được mật khẩu admin.
            cf_access.require_access(request)
        verify_request_captcha(request, 'login')
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        tokens = issue_tokens(user, request, auth_method='password')
        response = Response({'access': tokens['access']})
        return set_refresh_cookie(response, tokens['refresh'], user=user)


@extend_schema_view(
    get=extend_schema(summary='Thông tin tài khoản đang đăng nhập'),
    patch=extend_schema(
        summary='Cập nhật họ tên và số điện thoại',
        request=ProfileUpdateSerializer,
        responses={200: SessionUserSerializer},
    ),
)
@extend_schema(responses={200: SessionUserSerializer}, tags=['auth'])
class MeView(generics.RetrieveUpdateAPIView):
    """GET: thông tin tài khoản hiện tại. PATCH: cập nhật họ tên + SĐT.

    Chỉ nhận PATCH (không PUT) vì chỉ sửa một phần hồ sơ; email không đổi ở đây.
    """

    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch']

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        return ProfileUpdateSerializer if self.request.method == 'PATCH' else SessionUserSerializer

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_own_profile(request.user, serializer.validated_data)
        return Response(
            SessionUserSerializer(request.user, context=self.get_serializer_context()).data
        )


class AvatarUploadView(APIView):
    throttle_classes = with_default_throttles(WriteScopedRateThrottle)
    throttle_scope = 'avatar_upload'
    throttle_scope_methods = ('POST',)
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser]

    @extend_schema(
        summary='Upload avatar người dùng vào storage nội bộ',
        request=inline_serializer(
            'AvatarUploadRequest',
            fields={
                'file': serializers.FileField(help_text='Ảnh JPG, PNG, GIF hoặc WebP, tối đa 5MB')
            },
        ),
        responses={200: SessionUserSerializer},
        tags=['auth'],
    )
    def post(self, request):
        upload = request.FILES.get('file')
        if not upload:
            raise ValidationError({'file': 'This field is required.'})
        user = replace_avatar(request.user, upload)
        return Response(SessionUserSerializer(user, context={'request': request}).data)

    @extend_schema(
        summary='Xóa avatar người dùng',
        request=None,
        responses={200: SessionUserSerializer},
        tags=['auth'],
    )
    def delete(self, request):
        user = remove_avatar(request.user)
        return Response(SessionUserSerializer(user, context={'request': request}).data)

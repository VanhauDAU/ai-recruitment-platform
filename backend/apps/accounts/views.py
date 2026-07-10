import logging
from urllib.parse import urlencode

from django.contrib.auth.models import update_last_login
from django.shortcuts import redirect
from django.urls import reverse
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.common.media_storage import delete_local_media_url, save_image_upload

from . import email_verification as ev
from . import oauth
from .models import User
from .serializers import (
    ChangeEmailSerializer,
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


def _issue_tokens(user):
    """Trả về access/refresh JWT (kèm claim role/email) cho `user`.

    Dùng cho đăng ký (auto-login) và social login — 2 luồng phát JWT không đi
    qua `RoleTokenObtainPairSerializer` nên tự cập nhật `last_login` ở đây.
    """
    update_last_login(None, user)
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

        # Database chỉ lưu storage key; serializer sẽ resolve URL theo domain/CDN
        # hiện tại khi trả API.
        user.avatar_url = saved['path']
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


# ---- Social login (OAuth) — logic ở apps/accounts/oauth.py ----

def _oauth_error_redirect(portal, error_code):
    return redirect(f'{oauth.frontend_callback_url(portal)}?{urlencode({"error": error_code})}')


@extend_schema(exclude=True)  # endpoint redirect toàn trang, không dùng qua Swagger
class OAuthStartView(APIView):
    """Bắt đầu luồng OAuth: dựng state + redirect sang trang consent của provider."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, provider):
        portal = request.query_params.get('portal', 'main')
        if portal not in oauth.PORTAL_PROVIDERS:  # admin & giá trị lạ: không có social login
            return _oauth_error_redirect('main', 'portal_not_supported')
        if provider not in oauth.PORTAL_PROVIDERS[portal]:
            return _oauth_error_redirect(portal, 'provider_not_allowed')

        next_path = oauth.safe_next(request.query_params.get('next', ''))
        try:
            redirect_uri = request.build_absolute_uri(
                reverse('auth-oauth-callback', args=[provider])
            )
            state = oauth.create_state(provider, portal, next_path)
            return redirect(oauth.build_authorize_url(provider, redirect_uri, state))
        except oauth.OAuthError as exc:
            return _oauth_error_redirect(portal, exc.code)


@extend_schema(exclude=True)
class OAuthCallbackView(APIView):
    """Provider gọi lại sau consent: verify state, đổi code, tạo/liên kết user,
    phát one_time_code rồi redirect về trang callback frontend."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, provider):
        state_data = oauth.pop_state(request.query_params.get('state'))
        if not state_data or state_data.get('provider') != provider:
            return _oauth_error_redirect('main', 'invalid_state')

        portal = state_data['portal']
        if request.query_params.get('error'):  # user bấm Huỷ/Từ chối ở provider
            return _oauth_error_redirect(portal, 'access_denied')
        code = request.query_params.get('code')
        if not code:
            return _oauth_error_redirect(portal, 'invalid_state')

        try:
            redirect_uri = request.build_absolute_uri(
                reverse('auth-oauth-callback', args=[provider])
            )
            token = oauth.exchange_code(provider, code, redirect_uri)
            profile = oauth.fetch_profile(provider, token)
            user = oauth.resolve_user(provider, profile, portal)
        except oauth.OAuthError as exc:
            return _oauth_error_redirect(portal, exc.code)

        params = {'code': oauth.create_one_time_code(user)}
        if state_data.get('next'):
            params['next'] = state_data['next']
        return redirect(f'{oauth.frontend_callback_url(portal)}?{urlencode(params)}')


@extend_schema(
    summary='Đổi one_time_code (từ OAuth callback) lấy JWT',
    request=inline_serializer('OAuthCompleteRequest', {'code': serializers.CharField()}),
    responses={200: inline_serializer(
        'OAuthComplete',
        {'user': UserSerializer(), 'access': serializers.CharField(), 'refresh': serializers.CharField()},
    )},
    tags=['auth'],
)
class OAuthCompleteView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'oauth'

    def post(self, request):
        user_id = oauth.pop_one_time_code(request.data.get('code'))
        user = User.objects.filter(pk=user_id, is_active=True).first() if user_id else None
        if user is None:
            return Response(
                {'detail': 'Mã đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({'user': UserSerializer(user).data, **_issue_tokens(user)})

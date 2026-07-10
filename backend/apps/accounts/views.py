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
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.views import TokenObtainPairView

from common.media_storage import delete_local_media_url, save_image_upload

from . import email_verification as ev
from . import oauth
from . import password_reset as pr
from .models import AuthEmailJob, User
from .serializers import (
    ChangeEmailSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    RoleTokenObtainPairSerializer,
    UserSerializer,
)
from .tasks import queue_auth_email

logger = logging.getLogger(__name__)


def _issue_tokens(user):
    """Trả về access/refresh JWT (kèm claim role/email) cho `user`.

    Dùng cho đăng ký (auto-login) và social login — 2 luồng phát JWT không đi
    qua `RoleTokenObtainPairSerializer` nên tự cập nhật `last_login` ở đây.
    """
    update_last_login(None, user)
    refresh = RoleTokenObtainPairSerializer.get_token(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def _revoke_refresh_tokens(user):
    """Chặn mọi phiên đăng nhập cũ sau khi mật khẩu bị đổi.

    Access token vẫn sống tới khi hết hạn (SimpleJWT không kiểm tra blacklist cho
    access token), nhưng kẻ giữ refresh token cũ không gia hạn thêm được nữa.
    """
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def _queue_verification_email(user):
    """Queue email xác thực sau khi request hoàn tất; không chờ SMTP."""
    ev.start_cooldown(user)
    return queue_auth_email(AuthEmailJob.Kind.VERIFICATION, user)


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
        _queue_verification_email(user)
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

        _queue_verification_email(user)
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

        _queue_verification_email(user)
        return Response(UserSerializer(user).data)


# ---- Đặt lại mật khẩu — logic token/email ở apps/accounts/password_reset.py ----

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
        _revoke_refresh_tokens(user)

        return Response({'detail': 'Đặt lại mật khẩu thành công.', 'role': user.role})


# ---- Social login (OAuth) — logic ở apps/accounts/oauth.py ----

def _oauth_error_redirect(portal, error_code):
    return redirect(f'{oauth.frontend_callback_url(portal)}?{urlencode({"error": error_code})}')


@extend_schema(exclude=True)  # endpoint redirect toàn trang, không dùng qua Swagger
class OAuthStartView(APIView):
    """Bắt đầu luồng OAuth: dựng state + redirect sang trang consent của provider."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'oauth'

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

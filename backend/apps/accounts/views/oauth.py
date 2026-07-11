"""Social login (OAuth Authorization Code Flow) — logic provider ở ../oauth.py."""

from urllib.parse import urlencode

from django.shortcuts import redirect
from django.urls import reverse
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .. import oauth
from ..models import User
from ..serializers import UserSerializer
from ..services.tokens import issue_tokens


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
        return Response({'user': UserSerializer(user).data, **issue_tokens(user)})

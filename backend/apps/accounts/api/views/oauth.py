"""Social login (OAuth Authorization Code Flow) — logic provider ở ../oauth.py."""

from django.conf import settings
from django.shortcuts import redirect
from django.urls import reverse
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services import oauth
from common.api.throttling import ClientIPScopedRateThrottle, with_account_write_cap

from ...services.refresh_cookies import set_refresh_cookie
from ...services.tokens import issue_tokens
from ..serializers import SessionUserSerializer


def _oauth_error_redirect(portal, error_code, nonce=''):
    return redirect(oauth.frontend_redirect_url(portal, {'error': error_code}, nonce))


def _callback_path(provider):
    return reverse('auth-oauth-callback', args=[provider])


def _bind_browser(response, provider, binding):
    # SameSite=Lax: provider trả về bằng điều hướng GET cấp cao nhất, cookie vẫn đi kèm.
    response.set_cookie(
        oauth.OAUTH_BROWSER_COOKIE,
        binding,
        max_age=settings.OAUTH_STATE_TTL,
        path=_callback_path(provider),
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite='Lax',
    )
    return response


@extend_schema(exclude=True)  # endpoint redirect toàn trang, không dùng qua Swagger
class OAuthStartView(APIView):
    """Bắt đầu luồng OAuth: dựng state + redirect sang trang consent của provider."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'oauth'

    def get(self, request, provider):
        params = request.query_params
        nonce = oauth.popup_nonce(params.get('mode'), params.get('nonce'))
        portal = params.get('portal', 'main')
        if portal not in oauth.PORTAL_PROVIDERS:  # admin & giá trị lạ: không có social login
            return _oauth_error_redirect('main', 'portal_not_supported', nonce)
        if provider not in oauth.portal_providers(portal):
            return _oauth_error_redirect(portal, 'provider_not_allowed', nonce)

        next_path = oauth.safe_next(params.get('next', ''))
        try:
            redirect_uri = request.build_absolute_uri(_callback_path(provider))
            binding = oauth.new_browser_binding()
            state = oauth.create_state(provider, portal, next_path, binding, nonce=nonce)
            return _bind_browser(
                redirect(oauth.build_authorize_url(provider, redirect_uri, state)),
                provider,
                binding,
            )
        except oauth.OAuthError as exc:
            return _oauth_error_redirect(portal, exc.code, nonce)


@extend_schema(exclude=True)
class OAuthCallbackView(APIView):
    """Provider gọi lại sau consent: verify state, đổi code, tạo/liên kết user,
    phát one_time_code rồi redirect về trang callback frontend."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, provider):
        response = self._complete(request, provider)
        response.delete_cookie(oauth.OAUTH_BROWSER_COOKIE, path=_callback_path(provider))
        return response

    def _complete(self, request, provider):
        state_data = oauth.pop_state(
            request.query_params.get('state'),
            request.COOKIES.get(oauth.OAUTH_BROWSER_COOKIE, ''),
        )
        # State hỏng/giả không cho biết chế độ popup: trang callback tự báo lỗi tại chỗ.
        if not state_data or state_data.get('provider') != provider:
            return _oauth_error_redirect('main', 'invalid_state')

        portal = state_data['portal']
        nonce = state_data.get('nonce', '')
        if request.query_params.get('error'):  # user bấm Huỷ/Từ chối ở provider
            return _oauth_error_redirect(portal, 'access_denied', nonce)
        code = request.query_params.get('code')
        if not code:
            return _oauth_error_redirect(portal, 'invalid_state', nonce)

        try:
            redirect_uri = request.build_absolute_uri(_callback_path(provider))
            one_time_code = oauth.complete_provider_login(provider, code, redirect_uri, portal)
        except oauth.OAuthError as exc:
            return _oauth_error_redirect(portal, exc.code, nonce)

        params = {'code': one_time_code}
        if state_data.get('next'):
            params['next'] = state_data['next']
        return redirect(oauth.frontend_redirect_url(portal, params, nonce))


@extend_schema(
    summary='Đổi one_time_code (từ OAuth callback) lấy JWT',
    request=inline_serializer('OAuthCompleteRequest', {'code': serializers.CharField()}),
    responses={
        200: inline_serializer(
            'OAuthComplete',
            {'user': SessionUserSerializer(), 'access': serializers.CharField()},
        )
    },
    tags=['auth'],
)
class OAuthCompleteView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = with_account_write_cap(ClientIPScopedRateThrottle)
    throttle_scope = 'oauth'

    def post(self, request):
        user = oauth.redeem_one_time_code(request.data.get('code'))
        # Social providers have completed their own identity verification.
        user_data = SessionUserSerializer(user, context={'request': request}).data
        tokens = issue_tokens(user, request, auth_method='oauth')
        response = Response({'user': user_data, 'access': tokens['access']})
        return set_refresh_cookie(response, tokens['refresh'], user=user)

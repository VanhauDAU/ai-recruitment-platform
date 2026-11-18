"""JWT refresh adapter for the accounts-domain access policy."""

from functools import partial

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenRefreshView

from ...services.refresh_cookies import (
    PORTAL_ROLE_BY_NAME,
    VALID_PORTALS,
    clear_refresh_cookie,
    refresh_from_request,
    set_refresh_cookie,
)
from ...services.tokens import refresh_session_tokens


class AccountTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        return refresh_session_tokens(
            attrs['refresh'],
            portal=self.context.get('portal'),
            rotate=partial(super().validate, attrs),
        )


@extend_schema(
    summary='Làm mới access token bằng refresh cookie của cổng',
    request=inline_serializer(
        'AccountTokenRefresh',
        {'portal': serializers.ChoiceField(choices=list(PORTAL_ROLE_BY_NAME))},
    ),
    responses={
        200: inline_serializer('TokenRefreshResult', {'access': serializers.CharField()}),
        204: None,
    },
    tags=['auth'],
)
class AccountTokenRefreshView(TokenRefreshView):
    serializer_class = AccountTokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        portal = request.data.get('portal') or request.headers.get('X-Auth-Portal')
        is_session_probe = request.headers.get('X-Session-Probe') == '1'
        if portal not in VALID_PORTALS:
            raise ValidationError({'portal': 'Cổng đăng nhập không hợp lệ.'})
        refresh = refresh_from_request(request, portal=portal)
        if not refresh:
            response = Response(
                None if is_session_probe else {'detail': 'Không tìm thấy phiên làm mới.'},
                status=(
                    status.HTTP_204_NO_CONTENT if is_session_probe else status.HTTP_401_UNAUTHORIZED
                ),
            )
            return clear_refresh_cookie(response, portal=portal)

        serializer = self.serializer_class(data={'refresh': refresh}, context={'portal': portal})
        try:
            serializer.is_valid(raise_exception=True)
        except (InvalidToken, TokenError):
            response = Response(
                (
                    None
                    if is_session_probe
                    else {'detail': 'Phiên làm mới không hợp lệ hoặc đã hết hạn.'}
                ),
                status=(
                    status.HTTP_204_NO_CONTENT if is_session_probe else status.HTTP_401_UNAUTHORIZED
                ),
            )
            return clear_refresh_cookie(response, portal=portal)

        data = dict(serializer.validated_data)
        user = data.pop('user')
        rotated_refresh = data.pop('refresh', None)
        response = Response(data, status=status.HTTP_200_OK)
        if rotated_refresh:
            set_refresh_cookie(response, rotated_refresh, user=user)
        return response

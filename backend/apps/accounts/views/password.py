"""Authenticated password setup/change workflow."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from ..serializers import PasswordChangeSerializer, SessionUserSerializer
from ..services.tokens import issue_tokens, revoke_refresh_tokens


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Đặt hoặc thay đổi mật khẩu của tài khoản đang đăng nhập',
        request=PasswordChangeSerializer,
        responses=inline_serializer('PasswordChangeResponse', fields={
            'detail': serializers.CharField(),
            'user': SessionUserSerializer(),
            'tokens': inline_serializer('PasswordChangeTokens', {
                'access': serializers.CharField(),
                'refresh': serializers.CharField(),
            }),
        }),
        tags=['auth'],
    )
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['password'])
        user.save(update_fields=['password', 'updated_at'])

        # Đổi mật khẩu là thao tác nhạy cảm: luôn rotate phiên hiện tại (OWASP —
        # thay session identifier sau thay đổi nhạy cảm) và cấp cặp token mới để
        # thiết bị hiện tại không bị văng giữa luồng (vd onboarding NTD).
        if serializer.validated_data['logout_all_sessions']:
            # Đăng xuất mọi thiết bị khác: thu hồi toàn bộ refresh token cũ...
            revoke_refresh_tokens(user)
        else:
            # ...ngược lại chỉ vô hiệu refresh token của phiên đang thao tác.
            self._blacklist(request.data.get('refresh'))

        return Response({
            'detail': 'Cập nhật mật khẩu thành công.',
            'user': SessionUserSerializer(user, context={'request': request}).data,
            'tokens': issue_tokens(user, request),
        })

    @staticmethod
    def _blacklist(refresh):
        if not refresh:
            return
        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            pass

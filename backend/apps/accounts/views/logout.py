"""Đăng xuất phía server: thu hồi refresh token, không chỉ xóa token ở client.

OWASP khuyến nghị logout phải vô hiệu hóa phiên ở server. Vì mô hình tách tài
khoản theo cổng (một email có thể có tài khoản ứng viên và NTD riêng, mỗi bên là
một row User riêng), việc thu hồi luôn chỉ áp dụng cho đúng token/row được chỉ định:

- ``/auth/logout/``      → blacklist đúng refresh token của phiên hiện tại.
- ``/auth/logout-all/``  → blacklist mọi refresh token của TÀI KHOẢN đang đăng nhập.
"""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from ..services.tokens import revoke_refresh_tokens


class LogoutView(APIView):
    # Sở hữu refresh token chính là bằng chứng để thu hồi chính nó -> AllowAny và
    # idempotent: token hết hạn/không hợp lệ/đã blacklist vẫn coi là logout thành công.
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary='Đăng xuất phiên hiện tại (blacklist refresh token)',
        request=inline_serializer('LogoutRequest', {
            'refresh': serializers.CharField(required=False, allow_blank=True),
        }),
        responses={200: inline_serializer('LogoutResponse', {'detail': serializers.CharField()})},
        tags=['auth'],
    )
    def post(self, request):
        token = request.data.get('refresh')
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        return Response({'detail': 'Đã đăng xuất.'}, status=status.HTTP_200_OK)


class LogoutAllView(APIView):
    # Thu hồi MỌI phiên của đúng tài khoản (row User) đang đăng nhập. Không tìm
    # các user khác cùng email: mỗi cổng là một tài khoản độc lập.
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Đăng xuất khỏi tất cả thiết bị của tài khoản hiện tại',
        request=None,
        responses={200: inline_serializer('LogoutAllResponse', {'detail': serializers.CharField()})},
        tags=['auth'],
    )
    def post(self, request):
        revoke_refresh_tokens(request.user)
        return Response({'detail': 'Đã đăng xuất khỏi tất cả thiết bị.'}, status=status.HTTP_200_OK)

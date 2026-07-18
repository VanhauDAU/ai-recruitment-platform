"""Authenticated password setup/change workflow."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from ..serializers import PasswordChangeSerializer, SessionUserSerializer
from ..services.tokens import revoke_refresh_tokens


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Đặt hoặc thay đổi mật khẩu của tài khoản đang đăng nhập',
        request=PasswordChangeSerializer,
        responses=inline_serializer('PasswordChangeResponse', fields={
            'detail': serializers.CharField(),
            'user': SessionUserSerializer(),
        }),
        tags=['auth'],
    )
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['password'])
        request.user.save(update_fields=['password', 'updated_at'])
        if serializer.validated_data['logout_all_sessions']:
            revoke_refresh_tokens(request.user)
        return Response({
            'detail': 'Cập nhật mật khẩu thành công.',
            'user': SessionUserSerializer(request.user, context={'request': request}).data,
        })

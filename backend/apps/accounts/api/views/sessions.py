"""Quản lý phiên đăng nhập theo thiết bị (xem/thu hồi).

Phiên gắn với đúng row user (một cổng) đang đăng nhập; thu hồi luôn scope theo
`request.user`, không đụng tài khoản cùng email ở cổng khác."""

from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ...models import AuthSession
from ...selectors import auth_session_history
from ...services import auth_sessions


class AuthSessionSerializer(serializers.ModelSerializer):
    current = serializers.SerializerMethodField()

    class Meta:
        model = AuthSession
        fields = [
            'id',
            'portal',
            'device_label',
            'ip_address',
            'created_at',
            'last_seen_at',
            'revoked_at',
            'current',
        ]

    def get_current(self, obj) -> bool:
        return str(obj.id) == self.context.get('current_sid')


def _current_sid(request):
    return request.auth.get('sid') if request.auth else None


class SessionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Danh sách thiết bị đang đăng nhập của tài khoản hiện tại',
        responses={200: AuthSessionSerializer(many=True)},
        tags=['auth'],
    )
    def get(self, request):
        # Mặc định giữ nguyên hợp đồng cũ (chỉ phiên còn hiệu lực).
        # `?scope=history` trả thêm phiên đã thu hồi/hết hạn cho màn hình nhật ký
        # đăng nhập — chỉ có dữ liệu từ khi AuthSession được đưa vào.
        if request.query_params.get('scope') == 'history':
            sessions = auth_session_history(request.user)
        else:
            sessions = auth_sessions.active_sessions(request.user)
        data = AuthSessionSerializer(
            sessions,
            many=True,
            context={'current_sid': _current_sid(request)},
        ).data
        return Response(data)


class SessionRevokeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Đăng xuất một thiết bị theo id phiên',
        responses={204: None},
        tags=['auth'],
    )
    def delete(self, request, session_id):
        auth_sessions.revoke_own_session(request.user, session_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionRevokeOthersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Đăng xuất khỏi các thiết bị khác (giữ thiết bị hiện tại)',
        request=None,
        responses={
            200: inline_serializer('SessionRevokeOthers', {'detail': serializers.CharField()})
        },
        tags=['auth'],
    )
    def post(self, request):
        auth_sessions.revoke_other_sessions(request.user, _current_sid(request))
        return Response({'detail': _('Đã đăng xuất khỏi các thiết bị khác.')})

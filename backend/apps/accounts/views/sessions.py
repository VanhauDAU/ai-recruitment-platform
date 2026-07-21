"""Quản lý phiên đăng nhập theo thiết bị (xem/thu hồi).

Phiên gắn với đúng row user (một cổng) đang đăng nhập; thu hồi luôn scope theo
`request.user`, không đụng tài khoản cùng email ở cổng khác."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import AuthSession
from ..services import auth_sessions


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
            'current',
        ]

    def get_current(self, obj):
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
        session = auth_sessions.active_sessions(request.user).filter(id=session_id).first()
        if session is None:
            return Response(
                {'detail': 'Không tìm thấy phiên đăng nhập.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        auth_sessions.revoke_session(session)
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
        sessions = auth_sessions.active_sessions(request.user)
        sid = _current_sid(request)
        if sid:
            sessions = sessions.exclude(id=sid)
        for session in sessions:
            auth_sessions.revoke_session(session)
        return Response({'detail': 'Đã đăng xuất khỏi các thiết bị khác.'})

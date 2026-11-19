"""Administrator invitations: manage (superuser) and accept (public token)."""

from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission

from ...selectors import (
    invitation_queryset,
)
from ...services import (
    accept_admin_invitation,
    create_admin_invitation,
    resend_admin_invitation,
    resolve_admin_invitation,
    revoke_admin_invitation,
)
from ..serializers.account_actions import (
    ReasonSerializer,
)
from ..serializers.admin_invitations import (
    AdminInvitationAcceptSerializer,
    AdminInvitationCreateSerializer,
    AdminInvitationSerializer,
    AdminInvitationTokenSerializer,
)


@extend_schema_view(
    list=extend_schema(summary='Danh sách lời mời quản trị'),
    retrieve=extend_schema(summary='Chi tiết lời mời quản trị'),
    create=extend_schema(
        summary='Mời quản trị viên mới',
        request=AdminInvitationCreateSerializer,
        responses={201: AdminInvitationSerializer},
    ),
)
class AdminInvitationViewSet(
    viewsets.GenericViewSet,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
):
    permission_classes = [AdminPortalPermission]
    lookup_field = 'public_id'
    require_superuser = True

    def get_queryset(self):
        return invitation_queryset(params=self.request.query_params)

    def get_serializer_class(self):
        if self.action == 'create':
            return AdminInvitationCreateSerializer
        return AdminInvitationSerializer

    def create(self, request, *args, **kwargs):
        serializer = AdminInvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = create_admin_invitation(
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(
            AdminInvitationSerializer(invitation_queryset().get(pk=invitation.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary='Gửi lại lời mời quản trị',
        request=None,
        responses={200: AdminInvitationSerializer},
    )
    @action(detail=True, methods=['post'])
    def resend(self, request, public_id=None):
        invitation = resend_admin_invitation(
            invitation=self.get_object(),
            actor=request.user,
        )
        return Response(AdminInvitationSerializer(invitation_queryset().get(pk=invitation.pk)).data)

    @extend_schema(
        summary='Thu hồi lời mời quản trị',
        request=ReasonSerializer,
        responses={200: AdminInvitationSerializer},
    )
    @action(detail=True, methods=['post'])
    def revoke(self, request, public_id=None):
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = revoke_admin_invitation(
            invitation=self.get_object(),
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(AdminInvitationSerializer(invitation).data)


@extend_schema(
    summary='Kiểm tra token lời mời quản trị',
    parameters=[AdminInvitationTokenSerializer],
    responses={
        200: inline_serializer(
            'AdminInvitationValidateResult',
            {
                'email': serializers.EmailField(),
                'full_name': serializers.CharField(),
                'expires_at': serializers.DateTimeField(),
            },
        )
    },
)
class AdminInvitationValidateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        serializer = AdminInvitationTokenSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        invitation = resolve_admin_invitation(serializer.validated_data['token'])
        return Response(
            {
                'email': invitation.user.email,
                'full_name': invitation.user.full_name,
                'expires_at': invitation.expires_at,
            }
        )


@extend_schema(
    summary='Nhận lời mời và kích hoạt tài khoản quản trị',
    request=AdminInvitationAcceptSerializer,
    responses={
        200: inline_serializer(
            'AdminInvitationAcceptResult',
            {'detail': serializers.CharField(), 'user_public_id': serializers.CharField()},
        )
    },
)
class AdminInvitationAcceptView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AdminInvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = accept_admin_invitation(**serializer.validated_data)
        return Response(
            {
                'detail': 'Tài khoản quản trị đã được kích hoạt.',
                'user_public_id': user.public_id,
            }
        )

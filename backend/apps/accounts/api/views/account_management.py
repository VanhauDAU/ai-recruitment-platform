from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from common.pagination import StandardPagination

from ...admin_access_rules import InvalidImpactToken, StaleImpactToken
from ...admin_invitation_tokens import InvalidAdminInvitationToken
from ...exceptions import AdminResourceChanged
from ...models import AuthEmailJob
from ...permissions import HasAdminPermission
from ...selectors import (
    account_activity_queryset,
    account_revoke_sessions_impact,
    account_sessions_queryset,
    account_status_impact,
    account_summary,
    accounts_queryset,
    available_invitation_roles,
    invitation_queryset,
    provisioning_scope_status_impact,
    provisioning_scopes_queryset,
)
from ...services import (
    accept_admin_invitation,
    confirm_account_status,
    confirm_provisioning_scope_status,
    confirm_revoke_account_sessions,
    create_admin_invitation,
    create_provisioning_scope,
    ensure_account_write_allowed,
    queue_account_security_email,
    resend_admin_invitation,
    resolve_admin_invitation,
    revoke_admin_invitation,
    update_account_profile,
    update_admin_invitation_role,
)
from ..serializers.account_management import (
    AccountActivitySerializer,
    AccountStatusChangeSerializer,
    AccountStatusImpactSerializer,
    AdminInvitationAcceptSerializer,
    AdminInvitationCreateSerializer,
    AdminInvitationSerializer,
    AdminInvitationTokenSerializer,
    AdminInvitationUpdateSerializer,
    InvitationRoleSerializer,
    ManagedAccountDetailSerializer,
    ManagedAccountSerializer,
    ManagedAccountUpdateSerializer,
    ManagedSessionSerializer,
    ProvisioningScopeConfirmSerializer,
    ProvisioningScopeCreateSerializer,
    ProvisioningScopeSerializer,
    ProvisioningScopeStatusSerializer,
    ReasonSerializer,
    RevokeSessionsSerializer,
)


def _call(service, **kwargs):
    try:
        return service(**kwargs)
    except DjangoValidationError as error:
        raise ValidationError(
            error.message_dict if hasattr(error, 'message_dict') else error.messages
        ) from error


def _confirmed_call(service, **kwargs):
    try:
        return _call(service, **kwargs)
    except InvalidImpactToken as error:
        raise ValidationError({'impact_token': str(error)}) from error
    except StaleImpactToken as error:
        raise AdminResourceChanged() from error


def _serialize_account(user, actor, *, detail=False):
    current = accounts_queryset(actor).get(pk=user.pk)
    serializer = ManagedAccountDetailSerializer if detail else ManagedAccountSerializer
    return serializer(current).data


class AdminAccountViewSet(
    viewsets.GenericViewSet, mixins.ListModelMixin, mixins.RetrieveModelMixin
):
    permission_classes = [HasAdminPermission]
    permission_match = 'any'
    pagination_class = StandardPagination
    lookup_field = 'public_id'
    required_admin_permissions = {
        'list': ['account.view', 'account.admin.view', 'account.admin.invite'],
        'retrieve': ['account.view', 'account.admin.view', 'account.admin.invite'],
        'summary': ['account.view', 'account.admin.view', 'account.admin.invite'],
        'update': ['account.profile.manage'],
        'partial_update': ['account.profile.manage'],
        'sessions': ['account.view', 'account.admin.view', 'account.admin.invite'],
        'activity': ['account.view', 'account.admin.view', 'account.admin.invite'],
        'status_impact': ['account.status.manage', 'account.admin.manage'],
        'change_status': ['account.status.manage', 'account.admin.manage'],
        'revoke_sessions_impact': ['account.security.manage', 'account.admin.manage'],
        'revoke_sessions': ['account.security.manage', 'account.admin.manage'],
        'send_password_reset': ['account.security.manage', 'account.admin.manage'],
        'resend_verification': ['account.security.manage', 'account.admin.manage'],
    }

    def get_queryset(self):
        params = self.request.query_params if self.action == 'list' else {}
        return accounts_queryset(self.request.user, params=params)

    def get_serializer_class(self):
        return (
            ManagedAccountDetailSerializer
            if self.action == 'retrieve'
            else ManagedAccountSerializer
        )

    @action(detail=False, methods=['get'])
    def summary(self, request):
        return Response(account_summary(request.user))

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = ManagedAccountUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _call(
            update_account_profile,
            user=user,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(_serialize_account(user, request.user, detail=True))

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def sessions(self, request, public_id=None):
        return Response(
            ManagedSessionSerializer(
                account_sessions_queryset(self.get_object()),
                many=True,
            ).data
        )

    @action(detail=True, methods=['get'])
    def activity(self, request, public_id=None):
        queryset = account_activity_queryset(self.get_object())
        page = self.paginate_queryset(queryset)
        serializer = AccountActivitySerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=['post'], url_path='status-impact')
    def status_impact(self, request, public_id=None):
        serializer = AccountStatusImpactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = self.get_object()
        _call(
            ensure_account_write_allowed,
            actor=request.user,
            user=user,
            permission='account.status.manage',
        )
        return Response(account_status_impact(user, **serializer.validated_data))

    @action(detail=True, methods=['post'], url_path='change-status')
    def change_status(self, request, public_id=None):
        serializer = AccountStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _confirmed_call(
            confirm_account_status,
            user=self.get_object(),
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(_serialize_account(user, request.user, detail=True))

    @action(detail=True, methods=['post'], url_path='revoke-sessions-impact')
    def revoke_sessions_impact(self, request, public_id=None):
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = self.get_object()
        _call(
            ensure_account_write_allowed,
            actor=request.user,
            user=user,
            permission='account.security.manage',
        )
        return Response(account_revoke_sessions_impact(user, **serializer.validated_data))

    @action(detail=True, methods=['post'], url_path='revoke-sessions')
    def revoke_sessions(self, request, public_id=None):
        serializer = RevokeSessionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revoked = _confirmed_call(
            confirm_revoke_account_sessions,
            user=self.get_object(),
            actor=request.user,
            **serializer.validated_data,
        )
        return Response({'revoked_session_count': revoked})

    @action(detail=True, methods=['post'], url_path='send-password-reset')
    def send_password_reset(self, request, public_id=None):
        _call(
            queue_account_security_email,
            user=self.get_object(),
            kind=AuthEmailJob.Kind.PASSWORD_RESET,
            actor=request.user,
        )
        return Response({'detail': 'Đã xếp lịch gửi email đặt lại mật khẩu.'})

    @action(detail=True, methods=['post'], url_path='resend-verification')
    def resend_verification(self, request, public_id=None):
        _call(
            queue_account_security_email,
            user=self.get_object(),
            kind=AuthEmailJob.Kind.VERIFICATION,
            actor=request.user,
        )
        return Response({'detail': 'Đã xếp lịch gửi email xác minh.'})


class AdminInvitationViewSet(
    viewsets.GenericViewSet,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
):
    permission_classes = [HasAdminPermission]
    pagination_class = StandardPagination
    lookup_field = 'public_id'
    required_admin_permissions = {
        'list': ['account.admin.invite'],
        'retrieve': ['account.admin.invite'],
        'create': ['account.admin.invite'],
        'available_roles': ['account.admin.invite'],
        'partial_update': ['account.admin.invite'],
        'resend': ['account.admin.invite'],
        'revoke': ['account.admin.invite'],
    }

    def get_queryset(self):
        return invitation_queryset(self.request.user, params=self.request.query_params)

    def get_serializer_class(self):
        if self.action == 'create':
            return AdminInvitationCreateSerializer
        if self.action == 'partial_update':
            return AdminInvitationUpdateSerializer
        return AdminInvitationSerializer

    def create(self, request, *args, **kwargs):
        serializer = AdminInvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = _call(
            create_admin_invitation,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(
            AdminInvitationSerializer(invitation_queryset(request.user).get(pk=invitation.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        serializer = AdminInvitationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = _call(
            update_admin_invitation_role,
            invitation=self.get_object(),
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(
            AdminInvitationSerializer(invitation_queryset(request.user).get(pk=invitation.pk)).data
        )

    @action(detail=False, methods=['get'], url_path='available-roles')
    def available_roles(self, request):
        return Response(
            InvitationRoleSerializer(
                available_invitation_roles(request.user),
                many=True,
            ).data
        )

    @action(detail=True, methods=['post'])
    def resend(self, request, public_id=None):
        invitation = _call(
            resend_admin_invitation,
            invitation=self.get_object(),
            actor=request.user,
        )
        return Response(
            AdminInvitationSerializer(invitation_queryset(request.user).get(pk=invitation.pk)).data
        )

    @action(detail=True, methods=['post'])
    def revoke(self, request, public_id=None):
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = _call(
            revoke_admin_invitation,
            invitation=self.get_object(),
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(AdminInvitationSerializer(invitation).data)


class AdminProvisioningScopeViewSet(
    viewsets.GenericViewSet,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
):
    permission_classes = [HasAdminPermission]
    pagination_class = None
    lookup_field = 'public_id'
    require_superuser = True
    required_admin_permissions = {
        'list': ['account.admin.manage'],
        'retrieve': ['account.admin.manage'],
        'create': ['account.admin.manage'],
        'status_impact': ['account.admin.manage'],
        'activate': ['account.admin.manage'],
        'deactivate': ['account.admin.manage'],
    }

    def get_queryset(self):
        return provisioning_scopes_queryset()

    def get_serializer_class(self):
        return (
            ProvisioningScopeCreateSerializer
            if self.action == 'create'
            else ProvisioningScopeSerializer
        )

    def create(self, request, *args, **kwargs):
        serializer = ProvisioningScopeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scope = _call(
            create_provisioning_scope,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(
            ProvisioningScopeSerializer(self.get_queryset().get(pk=scope.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='status-impact')
    def status_impact(self, request, public_id=None):
        serializer = ProvisioningScopeStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            provisioning_scope_status_impact(
                self.get_object(),
                **serializer.validated_data,
            )
        )

    def _change_status(self, request, desired):
        payload = {**request.data, 'is_active': desired}
        serializer = ProvisioningScopeConfirmSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        scope = _confirmed_call(
            confirm_provisioning_scope_status,
            scope=self.get_object(),
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(ProvisioningScopeSerializer(self.get_queryset().get(pk=scope.pk)).data)

    @action(detail=True, methods=['post'])
    def activate(self, request, public_id=None):
        return self._change_status(request, True)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, public_id=None):
        return self._change_status(request, False)


class AdminInvitationValidateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        serializer = AdminInvitationTokenSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        try:
            invitation = resolve_admin_invitation(serializer.validated_data['token'])
        except InvalidAdminInvitationToken as error:
            raise ValidationError({'token': str(error)}) from error
        return Response(
            {
                'email': invitation.user.email,
                'full_name': invitation.user.full_name,
                'expires_at': invitation.expires_at,
                'target_role': InvitationRoleSerializer(invitation.target_role).data,
            }
        )


class AdminInvitationAcceptView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AdminInvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = _call(
                accept_admin_invitation,
                **serializer.validated_data,
            )
        except InvalidAdminInvitationToken as error:
            raise ValidationError({'token': str(error)}) from error
        return Response(
            {
                'detail': 'Tài khoản quản trị đã được kích hoạt.',
                'user_public_id': user.public_id,
            }
        )

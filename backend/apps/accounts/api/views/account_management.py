from django.core.exceptions import ObjectDoesNotExist
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from common.pagination import StandardPagination

from ...admin_access_rules import InvalidImpactToken, StaleImpactToken
from ...admin_invitation_tokens import InvalidAdminInvitationToken
from ...exceptions import AdminPermissionDenied, AdminResourceChanged
from ...models import AuthEmailJob, User
from ...permissions import HasAdminPermission, require_admin_permission
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
    update_managed_account_profile,
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
from ..serializers.admin_account_resources import (
    AdminAccountProfileSerializer,
    AdminAccountProfileUpdateSerializer,
    AdminApplicationSerializer,
    AdminCampaignSerializer,
    AdminCandidateConsentSerializer,
    AdminCvSerializer,
    AdminJobSerializer,
    AdminRecruitmentNeedSerializer,
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
    return serializer(current, context={'can_view_sensitive': False}).data


def _can_view_sensitive(user):
    try:
        require_admin_permission(user, 'account.sensitive.view')
    except AdminPermissionDenied:
        return False
    return True


def _validated_account_params(query_params):
    params = query_params.copy()
    scope = params.get('scope', '').strip()
    if scope and scope not in {'users', 'recruiters'}:
        raise ValidationError({'scope': 'Phạm vi tài khoản không hợp lệ.'})
    role = params.get('role', '').strip()
    if role and role not in User.Role.values:
        raise ValidationError({'role': 'Vai trò tài khoản không hợp lệ.'})
    if scope == 'users' and role == User.Role.EMPLOYER:
        raise ValidationError({'role': 'Nhà tuyển dụng không thuộc phạm vi người dùng.'})
    if scope == 'recruiters' and role and role != User.Role.EMPLOYER:
        raise ValidationError({'role': 'Phạm vi nhà tuyển dụng chỉ chấp nhận role employer.'})
    statuses = [value.strip() for value in params.get('status', '').split(',') if value.strip()]
    if any(value not in User.Status.values for value in statuses):
        raise ValidationError({'status': 'Trạng thái tài khoản không hợp lệ.'})
    company_state = params.get('company_state', '').strip()
    if company_state and company_state not in {'linked', 'missing'}:
        raise ValidationError({'company_state': 'Trạng thái liên kết công ty không hợp lệ.'})
    return params


class AdminAccountViewSet(
    viewsets.GenericViewSet, mixins.ListModelMixin, mixins.RetrieveModelMixin
):
    permission_classes = [HasAdminPermission]
    permission_match = 'any'
    pagination_class = StandardPagination
    lookup_field = 'public_id'
    required_admin_permissions = {
        'list': [
            'account.view',
            'account.employer.view',
            'account.admin.view',
            'account.admin.invite',
            'employer_verification.view',
            'company_update.view',
        ],
        'retrieve': [
            'account.view',
            'account.employer.view',
            'account.admin.view',
            'account.admin.invite',
            'employer_verification.view',
            'company_update.view',
        ],
        'summary': [
            'account.view',
            'account.employer.view',
            'account.admin.view',
            'account.admin.invite',
            'employer_verification.view',
            'company_update.view',
        ],
        'update': ['account.profile.manage'],
        'partial_update': ['account.profile.manage'],
        'profile': [
            'account.view',
            'account.employer.view',
            'account.admin.view',
            'account.profile.manage',
            'employer_verification.view',
            'company_update.view',
        ],
        'cvs': ['account.view'],
        'applications': ['account.view'],
        'consents': ['account.view'],
        'recruitment_needs': [
            'account.view',
            'account.employer.view',
            'employer_verification.view',
        ],
        'jobs': ['account.view', 'account.employer.view', 'employer_verification.view'],
        'campaigns': [
            'account.view',
            'account.employer.view',
            'employer_verification.view',
        ],
        'sessions': [
            'account.view',
            'account.employer.view',
            'account.admin.view',
            'account.admin.invite',
        ],
        'activity': [
            'account.view',
            'account.employer.view',
            'account.admin.view',
            'account.admin.invite',
        ],
        'status_impact': ['account.status.manage', 'account.admin.manage'],
        'change_status': ['account.status.manage', 'account.admin.manage'],
        'revoke_sessions_impact': ['account.security.manage', 'account.admin.manage'],
        'revoke_sessions': ['account.security.manage', 'account.admin.manage'],
        'send_password_reset': ['account.security.manage', 'account.admin.manage'],
        'resend_verification': ['account.security.manage', 'account.admin.manage'],
    }

    def get_queryset(self):
        params = (
            _validated_account_params(self.request.query_params) if self.action == 'list' else {}
        )
        queryset = accounts_queryset(self.request.user, params=params)
        if self.action == 'profile':
            queryset = queryset.select_related(
                'recruiter_profile__company__created_by',
            ).prefetch_related(
                'recruiter_profile__company__images',
            )
        return queryset

    def get_serializer_class(self):
        return (
            ManagedAccountDetailSerializer
            if self.action == 'retrieve'
            else ManagedAccountSerializer
        )

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            # Sensitive values are revealed only through the explicit profile
            # request so merely opening a shared URL never creates exposure.
            'can_view_sensitive': False,
        }

    def _paginated(self, queryset, serializer_class):
        page = self.paginate_queryset(queryset)
        serializer = serializer_class(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        params = _validated_account_params(request.query_params)
        return Response(account_summary(request.user, scope=params.get('scope', '')))

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

    @action(detail=True, methods=['get', 'patch'])
    def profile(self, request, public_id=None):
        user = self.get_object()
        if request.method == 'PATCH':
            require_admin_permission(request.user, 'account.profile.manage')
            serializer = AdminAccountProfileUpdateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = _call(
                update_managed_account_profile,
                user=user,
                actor=request.user,
                changes=serializer.validated_data,
            )
            user = accounts_queryset(request.user).get(pk=user.pk)
            return Response(
                AdminAccountProfileSerializer(
                    user,
                    context={'can_view_sensitive': False, 'request': request},
                ).data
            )

        reveal = request.query_params.get('reveal', '').lower() in {'1', 'true'}
        if reveal:
            require_admin_permission(request.user, 'account.sensitive.view')
            from ...services import record_admin_action

            record_admin_action(
                actor=request.user,
                action='reveal_account_sensitive_profile',
                target_type='user',
                target_public_id=user.public_id,
                payload={'user_public_id': user.public_id},
            )
        return Response(
            AdminAccountProfileSerializer(
                user,
                context={
                    'can_view_sensitive': reveal and _can_view_sensitive(request.user),
                    'request': request,
                },
            ).data
        )

    @action(detail=True, methods=['get'])
    def cvs(self, request, public_id=None):
        user = self.get_object()
        return self._paginated(
            user.cvs.filter(is_deleted=False)
            .select_related('template')
            .order_by(
                '-updated_at',
                '-id',
            ),
            AdminCvSerializer,
        )

    @action(detail=True, methods=['get'])
    def applications(self, request, public_id=None):
        user = self.get_object()
        return self._paginated(
            user.applications.select_related(
                'job__company',
                'submitted_cv_version',
            ).order_by('-applied_at', '-id'),
            AdminApplicationSerializer,
        )

    @action(detail=True, methods=['get'])
    def consents(self, request, public_id=None):
        user = self.get_object()
        try:
            queryset = user.candidate_profile.consents.order_by('consent_type')
        except ObjectDoesNotExist:
            queryset = user.applications.none()
        return self._paginated(queryset, AdminCandidateConsentSerializer)

    @action(detail=True, methods=['get'], url_path='recruitment-needs')
    def recruitment_needs(self, request, public_id=None):
        user = self.get_object()
        try:
            queryset = user.recruiter_profile.recruitment_needs.select_related(
                'position_category'
            ).order_by('-updated_at', '-id')
        except ObjectDoesNotExist:
            queryset = user.posted_jobs.none()
        return self._paginated(queryset, AdminRecruitmentNeedSerializer)

    @action(detail=True, methods=['get'])
    def jobs(self, request, public_id=None):
        return self._paginated(
            self.get_object()
            .posted_jobs.select_related('company', 'campaign')
            .order_by('-updated_at', '-id'),
            AdminJobSerializer,
        )

    @action(detail=True, methods=['get'])
    def campaigns(self, request, public_id=None):
        user = self.get_object()
        try:
            queryset = (
                user.recruiter_profile.campaigns.select_related('position_category')
                .annotate(
                    job_count=Count('jobs', distinct=True),
                    application_count=Count('jobs__applications', distinct=True),
                )
                .order_by('-updated_at', '-id')
            )
        except ObjectDoesNotExist:
            queryset = user.posted_jobs.none()
        return self._paginated(queryset, AdminCampaignSerializer)

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

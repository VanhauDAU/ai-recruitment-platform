from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view, inline_serializer
from rest_framework import mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission
from apps.accounts.domain.impact_token_rules import InvalidImpactToken, StaleImpactToken
from apps.accounts.services.exceptions import AdminPermissionDenied, AdminResourceChanged
from common.api.params import parse_bool

from ...models import AuthEmailJob, User
from ...selectors import (
    account_activity_queryset,
    account_applications_queryset,
    account_campaigns_queryset,
    account_consents_queryset,
    account_cvs_queryset,
    account_email_change_impact,
    account_jobs_queryset,
    account_recruitment_needs_queryset,
    account_resource_hold_impact,
    account_revoke_sessions_impact,
    account_sessions_queryset,
    account_status_impact,
    account_summary,
    accounts_queryset,
    invitation_queryset,
)
from ...services import (
    accept_admin_invitation,
    confirm_account_email,
    confirm_account_status,
    confirm_release_account_resource_holds,
    confirm_revoke_account_sessions,
    create_admin_invitation,
    ensure_account_recovery_allowed,
    ensure_account_status_change_allowed,
    ensure_account_write_allowed,
    queue_account_security_email,
    resend_admin_invitation,
    resolve_admin_invitation,
    revoke_admin_invitation,
    update_account_profile,
    update_managed_account_profile,
)
from ..serializers.account_management import (
    AccountActivitySerializer,
    AccountEmailChangeSerializer,
    AccountEmailImpactSerializer,
    AccountResourceHoldChangeSerializer,
    AccountResourceHoldImpactResponseSerializer,
    AccountResourceHoldImpactSerializer,
    AccountStatusChangeSerializer,
    AccountStatusImpactResponseSerializer,
    AccountStatusImpactSerializer,
    AdminInvitationAcceptSerializer,
    AdminInvitationCreateSerializer,
    AdminInvitationSerializer,
    AdminInvitationTokenSerializer,
    EmployerCompanyUnlinkConfirmSerializer,
    EmployerCompanyUnlinkImpactResponseSerializer,
    EmployerCompanyUnlinkImpactSerializer,
    ManagedAccountDetailSerializer,
    ManagedAccountSerializer,
    ManagedAccountUpdateSerializer,
    ManagedSessionSerializer,
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

_DETAIL_RESPONSE = inline_serializer('AccountActionDetail', {'detail': serializers.CharField()})


def _confirmed_call(service, **kwargs):
    try:
        return service(**kwargs)
    except InvalidImpactToken as error:
        raise ValidationError({'impact_token': str(error)}) from error
    except StaleImpactToken as error:
        raise AdminResourceChanged() from error


def _serialize_account(user, actor, *, detail=False):
    current = accounts_queryset(actor).get(pk=user.pk)
    serializer = ManagedAccountDetailSerializer if detail else ManagedAccountSerializer
    return serializer(current, context={'can_view_sensitive': False}).data


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


@extend_schema_view(
    list=extend_schema(summary='Danh sách tài khoản'),
    retrieve=extend_schema(
        summary='Chi tiết tài khoản', responses={200: ManagedAccountDetailSerializer}
    ),
    update=extend_schema(
        summary='Sửa thông tin tài khoản',
        request=ManagedAccountUpdateSerializer,
        responses={200: ManagedAccountDetailSerializer},
    ),
    partial_update=extend_schema(
        summary='Sửa thông tin tài khoản',
        request=ManagedAccountUpdateSerializer,
        responses={200: ManagedAccountDetailSerializer},
    ),
)
class AdminAccountViewSet(
    viewsets.GenericViewSet, mixins.ListModelMixin, mixins.RetrieveModelMixin
):
    permission_classes = [AdminPortalPermission]
    lookup_field = 'public_id'

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

    @extend_schema(
        summary='Thống kê tài khoản theo trạng thái',
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(detail=False, methods=['get'])
    def summary(self, request):
        params = _validated_account_params(request.query_params)
        return Response(account_summary(request.user, scope=params.get('scope', '')))

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = ManagedAccountUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = update_account_profile(
            user=user,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(_serialize_account(user, request.user, detail=True))

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @extend_schema(
        summary='Hồ sơ chi tiết của tài khoản (PATCH: sửa hồ sơ)',
        request=AdminAccountProfileUpdateSerializer,
        responses={200: AdminAccountProfileSerializer},
    )
    @action(detail=True, methods=['get', 'patch'])
    def profile(self, request, public_id=None):
        user = self.get_object()
        if request.method == 'PATCH':
            serializer = AdminAccountProfileUpdateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = update_managed_account_profile(
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

        reveal = parse_bool(request.query_params.get('reveal'), False)
        if reveal:
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
                    'can_view_sensitive': reveal,
                    'request': request,
                },
            ).data
        )

    @extend_schema(summary='CV của tài khoản', responses={200: AdminCvSerializer(many=True)})
    @action(detail=True, methods=['get'])
    def cvs(self, request, public_id=None):
        return self._paginated(account_cvs_queryset(self.get_object()), AdminCvSerializer)

    @extend_schema(
        summary='Hồ sơ ứng tuyển của tài khoản',
        responses={200: AdminApplicationSerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def applications(self, request, public_id=None):
        return self._paginated(
            account_applications_queryset(self.get_object()), AdminApplicationSerializer
        )

    @extend_schema(
        summary='Đồng ý dữ liệu của ứng viên',
        responses={200: AdminCandidateConsentSerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def consents(self, request, public_id=None):
        return self._paginated(
            account_consents_queryset(self.get_object()), AdminCandidateConsentSerializer
        )

    @extend_schema(
        summary='Nhu cầu tuyển dụng của NTD',
        responses={200: AdminRecruitmentNeedSerializer(many=True)},
    )
    @action(detail=True, methods=['get'], url_path='recruitment-needs')
    def recruitment_needs(self, request, public_id=None):
        return self._paginated(
            account_recruitment_needs_queryset(self.get_object()), AdminRecruitmentNeedSerializer
        )

    @extend_schema(summary='Tin tuyển dụng của NTD', responses={200: AdminJobSerializer(many=True)})
    @action(detail=True, methods=['get'])
    def jobs(self, request, public_id=None):
        return self._paginated(account_jobs_queryset(self.get_object()), AdminJobSerializer)

    @extend_schema(
        summary='Chiến dịch tuyển dụng của NTD',
        responses={200: AdminCampaignSerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def campaigns(self, request, public_id=None):
        return self._paginated(
            account_campaigns_queryset(self.get_object()), AdminCampaignSerializer
        )

    @extend_schema(
        summary='Phiên đăng nhập của tài khoản',
        responses={200: ManagedSessionSerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def sessions(self, request, public_id=None):
        return Response(
            ManagedSessionSerializer(
                account_sessions_queryset(self.get_object()),
                many=True,
            ).data
        )

    @extend_schema(
        summary='Nhật ký hoạt động của tài khoản',
        responses={200: AccountActivitySerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def activity(self, request, public_id=None):
        queryset = account_activity_queryset(self.get_object())
        page = self.paginate_queryset(queryset)
        serializer = AccountActivitySerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @extend_schema(
        request=AccountStatusImpactSerializer,
        responses={200: AccountStatusImpactResponseSerializer},
        summary='Preview tác động thay đổi trạng thái tài khoản',
    )
    @action(detail=True, methods=['post'], url_path='status-impact')
    def status_impact(self, request, public_id=None):
        user = self.get_object()
        serializer = AccountStatusImpactSerializer(
            data=request.data,
            context={'target': user},
        )
        serializer.is_valid(raise_exception=True)
        ensure_account_status_change_allowed(
            actor=request.user,
            user=user,
            status=serializer.validated_data['status'],
        )
        return Response(account_status_impact(user, **serializer.validated_data))

    @extend_schema(
        request=AccountStatusChangeSerializer,
        responses={200: ManagedAccountDetailSerializer},
        summary='Xác nhận thay đổi trạng thái tài khoản',
    )
    @action(detail=True, methods=['post'], url_path='change-status')
    def change_status(self, request, public_id=None):
        target = self.get_object()
        serializer = AccountStatusChangeSerializer(
            data=request.data,
            context={'target': target},
        )
        serializer.is_valid(raise_exception=True)
        user = _confirmed_call(
            confirm_account_status,
            user=target,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(_serialize_account(user, request.user, detail=True))

    @extend_schema(
        request=AccountResourceHoldImpactSerializer,
        responses={200: AccountResourceHoldImpactResponseSerializer},
        summary='Preview tác động gỡ policy hold của tài khoản',
    )
    @action(detail=True, methods=['post'], url_path='resource-hold-impact')
    def resource_hold_impact(self, request, public_id=None):
        serializer = AccountResourceHoldImpactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = self.get_object()
        ensure_account_write_allowed(
            actor=request.user,
            user=user,
        )
        if not request.user.is_superuser:
            raise AdminPermissionDenied('Gỡ policy hold chỉ dành cho superuser.')
        return Response(account_resource_hold_impact(user, **serializer.validated_data))

    @extend_schema(
        request=AccountResourceHoldChangeSerializer,
        responses={200: ManagedAccountDetailSerializer},
        summary='Xác nhận gỡ policy hold sau rà soát',
    )
    @action(detail=True, methods=['post'], url_path='release-resource-holds')
    def release_resource_holds(self, request, public_id=None):
        serializer = AccountResourceHoldChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _confirmed_call(
            confirm_release_account_resource_holds,
            user=self.get_object(),
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(_serialize_account(user, request.user, detail=True))

    @extend_schema(
        summary='Preview tác động thu hồi phiên đăng nhập',
        request=ReasonSerializer,
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(detail=True, methods=['post'], url_path='revoke-sessions-impact')
    def revoke_sessions_impact(self, request, public_id=None):
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = self.get_object()
        ensure_account_write_allowed(
            actor=request.user,
            user=user,
        )
        return Response(account_revoke_sessions_impact(user, **serializer.validated_data))

    @extend_schema(
        summary='Xác nhận thu hồi mọi phiên đăng nhập',
        request=RevokeSessionsSerializer,
        responses={
            200: inline_serializer(
                'AccountRevokeSessionsResult', {'revoked_session_count': serializers.IntegerField()}
            )
        },
    )
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

    @extend_schema(
        summary='Preview tác động đổi email đăng nhập',
        request=AccountEmailImpactSerializer,
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(detail=True, methods=['post'], url_path='email-impact')
    def email_impact(self, request, public_id=None):
        user = self.get_object()
        serializer = AccountEmailImpactSerializer(
            data=request.data,
            context={'target_user': user},
        )
        serializer.is_valid(raise_exception=True)
        ensure_account_recovery_allowed(
            actor=request.user,
            user=user,
        )
        return Response(account_email_change_impact(user, **serializer.validated_data))

    @extend_schema(
        summary='Xác nhận đổi email đăng nhập',
        request=AccountEmailChangeSerializer,
        responses={200: ManagedAccountDetailSerializer},
    )
    @action(detail=True, methods=['post'], url_path='change-email')
    def change_email(self, request, public_id=None):
        user = self.get_object()
        serializer = AccountEmailChangeSerializer(
            data=request.data,
            context={'target_user': user},
        )
        serializer.is_valid(raise_exception=True)
        user = _confirmed_call(
            confirm_account_email,
            user=user,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(_serialize_account(user, request.user, detail=True))

    @extend_schema(
        summary='Gửi email đặt lại mật khẩu cho tài khoản',
        request=ReasonSerializer,
        responses={200: _DETAIL_RESPONSE},
    )
    @action(detail=True, methods=['post'], url_path='send-password-reset')
    def send_password_reset(self, request, public_id=None):
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        queue_account_security_email(
            user=self.get_object(),
            kind=AuthEmailJob.Kind.PASSWORD_RESET,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response({'detail': 'Đã xếp lịch gửi email đặt lại mật khẩu.'})

    @extend_schema(
        summary='Gửi lại email xác minh cho tài khoản',
        request=None,
        responses={200: _DETAIL_RESPONSE},
    )
    @action(detail=True, methods=['post'], url_path='resend-verification')
    def resend_verification(self, request, public_id=None):
        queue_account_security_email(
            user=self.get_object(),
            kind=AuthEmailJob.Kind.VERIFICATION,
            actor=request.user,
        )
        return Response({'detail': 'Đã xếp lịch gửi email xác minh.'})

    @extend_schema(
        request=EmployerCompanyUnlinkImpactSerializer,
        responses={200: EmployerCompanyUnlinkImpactResponseSerializer},
        summary='Xem tác động trước khi gỡ liên kết công ty chọn nhầm',
    )
    @action(detail=True, methods=['post'], url_path='company-unlink-impact')
    def company_unlink_impact(self, request, public_id=None):
        serializer = EmployerCompanyUnlinkImpactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from apps.employers.services import CompanyUnlinkError, company_unlink_impact

        try:
            impact = company_unlink_impact(
                self.get_object(),
                actor=request.user,
                **serializer.validated_data,
            )
        except CompanyUnlinkError as error:
            raise ValidationError(
                {
                    'code': error.code,
                    'detail': error.message,
                    'blockers': list(error.blockers),
                }
            ) from error
        return Response(impact)

    @extend_schema(
        request=EmployerCompanyUnlinkConfirmSerializer,
        responses={200: ManagedAccountDetailSerializer},
        summary='Xác nhận gỡ liên kết công ty chọn nhầm khi account còn clean',
    )
    @action(detail=True, methods=['post'], url_path='unlink-company')
    def unlink_company(self, request, public_id=None):
        serializer = EmployerCompanyUnlinkConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from apps.employers.services import CompanyUnlinkError, confirm_company_unlink

        target = self.get_object()
        try:
            _confirmed_call(
                confirm_company_unlink,
                user=target,
                actor=request.user,
                **serializer.validated_data,
            )
        except CompanyUnlinkError as error:
            raise ValidationError(
                {
                    'code': error.code,
                    'detail': error.message,
                    'blockers': list(error.blockers),
                }
            ) from error
        return Response(_serialize_account(target, request.user, detail=True))


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

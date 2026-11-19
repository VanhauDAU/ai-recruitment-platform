"""Destructive admin account actions, each split into impact preview and confirm.

The preview returns an impact token bound to the current state; the confirm call
must echo it back so an admin never acts on numbers that changed meanwhile.
"""

from django.utils.translation import gettext as _
from drf_spectacular.utils import OpenApiTypes, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.domain.impact_token_rules import InvalidImpactToken, StaleImpactToken
from apps.accounts.services.exceptions import AdminPermissionDenied, AdminResourceChanged

from ...models import AuthEmailJob
from ...selectors import (
    account_email_change_impact,
    account_resource_hold_impact,
    account_revoke_sessions_impact,
    account_status_impact,
)
from ...services import (
    confirm_account_email,
    confirm_account_status,
    confirm_release_account_resource_holds,
    confirm_revoke_account_sessions,
    ensure_account_recovery_allowed,
    ensure_account_status_change_allowed,
    ensure_account_write_allowed,
    queue_account_security_email,
)
from ..serializers.account_actions import (
    AccountEmailChangeSerializer,
    AccountEmailImpactSerializer,
    AccountResourceHoldChangeSerializer,
    AccountResourceHoldImpactResponseSerializer,
    AccountResourceHoldImpactSerializer,
    AccountStatusChangeSerializer,
    AccountStatusImpactResponseSerializer,
    AccountStatusImpactSerializer,
    EmployerCompanyUnlinkConfirmSerializer,
    EmployerCompanyUnlinkImpactResponseSerializer,
    EmployerCompanyUnlinkImpactSerializer,
    ReasonPreviewSerializer,
    ReasonSerializer,
    RevokeSessionsSerializer,
)
from ..serializers.managed_accounts import (
    ManagedAccountDetailSerializer,
)

_DETAIL_RESPONSE = inline_serializer('AccountActionDetail', {'detail': serializers.CharField()})


def _confirmed_call(service, **kwargs):
    try:
        return service(**kwargs)
    except InvalidImpactToken as error:
        raise ValidationError({'impact_token': str(error)}) from error
    except StaleImpactToken as error:
        raise AdminResourceChanged() from error


class AccountEnforcementActionsMixin:
    """Status, resource-hold, session, email and company-link actions."""

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
        return Response(self._account_detail(user))

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
            raise AdminPermissionDenied(_('Gỡ policy hold chỉ dành cho superuser.'))
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
        return Response(self._account_detail(user))

    @extend_schema(
        summary='Preview tác động thu hồi phiên đăng nhập',
        request=ReasonPreviewSerializer,
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(detail=True, methods=['post'], url_path='revoke-sessions-impact')
    def revoke_sessions_impact(self, request, public_id=None):
        serializer = ReasonPreviewSerializer(data=request.data)
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
        return Response(self._account_detail(user))

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
        return Response({'detail': _('Đã xếp lịch gửi email đặt lại mật khẩu.')})

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
        return Response({'detail': _('Đã xếp lịch gửi email xác minh.')})

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
        return Response(self._account_detail(target))

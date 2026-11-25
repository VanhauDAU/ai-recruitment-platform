"""Administrator account directory: list, detail, summary and profile edits."""

from django.utils.translation import gettext as _
from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission
from common.api.params import parse_bool

from ...domain.recruiter_next_action import next_action_codes
from ...models import User
from ...selectors import (
    account_summary,
    accounts_queryset,
)
from ...services import (
    update_account_profile,
    update_managed_account_profile,
)
from ..serializers.admin_account_profile import (
    AdminAccountProfileSerializer,
    AdminAccountProfileUpdateSerializer,
)
from ..serializers.managed_accounts import (
    ManagedAccountDetailSerializer,
    ManagedAccountSerializer,
    ManagedAccountUpdateSerializer,
)
from .admin_account_actions import AccountEnforcementActionsMixin
from .admin_account_resources import AccountResourceActionsMixin


def _validated_account_params(query_params):
    params = query_params.copy()
    scope = params.get('scope', '').strip()
    if scope and scope not in {'users', 'recruiters'}:
        raise ValidationError({'scope': _('Phạm vi tài khoản không hợp lệ.')})
    role = params.get('role', '').strip()
    if role and role not in User.Role.values:
        raise ValidationError({'role': _('Vai trò tài khoản không hợp lệ.')})
    if scope == 'users' and role == User.Role.EMPLOYER:
        raise ValidationError({'role': _('Nhà tuyển dụng không thuộc phạm vi người dùng.')})
    if scope == 'recruiters' and role and role != User.Role.EMPLOYER:
        raise ValidationError({'role': _('Phạm vi nhà tuyển dụng chỉ chấp nhận role employer.')})
    statuses = [value.strip() for value in params.get('status', '').split(',') if value.strip()]
    if any(value not in User.Status.values for value in statuses):
        raise ValidationError({'status': _('Trạng thái tài khoản không hợp lệ.')})
    company_state = params.get('company_state', '').strip()
    if company_state and company_state not in {'linked', 'missing'}:
        raise ValidationError({'company_state': _('Trạng thái liên kết công ty không hợp lệ.')})
    next_action_value = params.get('next_action', '').strip()
    if next_action_value and not next_action_codes(next_action_value):
        raise ValidationError({'next_action': _('Việc cần làm không hợp lệ.')})
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
    AccountResourceActionsMixin,
    AccountEnforcementActionsMixin,
    viewsets.GenericViewSet,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
):
    permission_classes = [AdminPortalPermission]
    lookup_field = 'public_id'

    def get_queryset(self):
        # Schema generation has no admin behind the request; the scoped
        # selector cannot run there, so give drf-spectacular the model.
        if getattr(self, 'swagger_fake_view', False):
            return User.objects.none()
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

    def _account_detail(self, user):
        current = accounts_queryset(self.request.user).get(pk=user.pk)
        return ManagedAccountDetailSerializer(current, context={'can_view_sensitive': False}).data

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
        return Response(self._account_detail(user))

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

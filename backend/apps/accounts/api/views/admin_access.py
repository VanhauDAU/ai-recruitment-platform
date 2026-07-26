from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from common.pagination import StandardPagination

from ...admin_access_rules import InvalidImpactToken, StaleImpactToken
from ...exceptions import AdminResourceChanged
from ...models import AdminMembership, AdminRole
from ...permissions import HasAdminPermission, IsAdmin, require_admin_permission
from ...selectors import (
    admin_staff_queryset,
    audit_logs_queryset,
    department_status_impact,
    departments_queryset,
    membership_assignment_impact,
    membership_revoke_impact,
    memberships_queryset,
    permissions_queryset,
    restore_system_department_impact,
    restore_system_role_impact,
    role_permissions_impact,
    role_status_impact,
    roles_queryset,
)
from ...services import (
    confirm_department_status_change,
    confirm_membership_assignment,
    confirm_membership_revoke,
    confirm_restore_system_department,
    confirm_restore_system_role,
    confirm_role_permissions_update,
    confirm_role_status_change,
    create_department,
    create_role,
    update_department,
    update_role,
)
from ..serializers.admin_access import (
    AdminAuditLogSerializer,
    AdminMembershipCreateSerializer,
    AdminMembershipReadSerializer,
    AdminPermissionSerializer,
    AdminRoleCreateSerializer,
    AdminRoleReadSerializer,
    AdminRoleUpdateSerializer,
    AdminStaffSerializer,
    DepartmentCreateSerializer,
    DepartmentReadSerializer,
    DepartmentUpdateSerializer,
    MembershipActionConfirmationSerializer,
    MembershipAssignmentImpactSerializer,
    RestoreSystemDefaultConfirmationSerializer,
    RolePermissionImpactSerializer,
    RolePermissionUpdateSerializer,
    StatusChangeConfirmationSerializer,
    StatusImpactRequestSerializer,
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


def _actor_kwargs(request):
    return {'actor': request.user, 'source': 'api', 'actor_identifier': request.user.email}


class AdminDepartmentViewSet(viewsets.ModelViewSet):
    permission_classes = [HasAdminPermission]
    pagination_class = None
    lookup_field = 'public_id'
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']
    required_admin_permissions = {
        'list': ['admin_access.view'],
        'retrieve': ['admin_access.view'],
        'create': ['admin_access.manage_department'],
        'update': ['admin_access.manage_department'],
        'partial_update': ['admin_access.manage_department'],
        'activate': ['admin_access.manage_department'],
        'deactivate': ['admin_access.manage_department'],
        'status_impact': ['admin_access.manage_department'],
        'restore_system_default': ['admin_access.manage_department'],
    }
    require_superuser = {
        'actions': {
            'create',
            'update',
            'partial_update',
            'activate',
            'deactivate',
            'status_impact',
            'restore_system_default',
        }
    }

    def get_queryset(self):
        return departments_queryset()

    def get_serializer_class(self):
        if self.action == 'create':
            return DepartmentCreateSerializer
        if self.action in {'update', 'partial_update'}:
            return DepartmentUpdateSerializer
        return DepartmentReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = DepartmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        department = _call(
            create_department,
            **serializer.validated_data,
            **_actor_kwargs(request),
        )
        return Response(
            DepartmentReadSerializer(departments_queryset().get(pk=department.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        department = self.get_object()
        serializer = DepartmentUpdateSerializer(
            department,
            data=request.data,
            partial=kwargs.pop('partial', False),
        )
        serializer.is_valid(raise_exception=True)
        department = _call(
            update_department,
            department=department,
            name=serializer.validated_data.get('name', department.name),
            description=serializer.validated_data.get(
                'description',
                department.description,
            ),
            **_actor_kwargs(request),
        )
        return Response(DepartmentReadSerializer(departments_queryset().get(pk=department.pk)).data)

    @action(detail=True, methods=['post'], url_path='status-impact')
    def status_impact(self, request, public_id=None):
        serializer = StatusImpactRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            department_status_impact(
                self.get_object(),
                is_active=serializer.validated_data['is_active'],
            )
        )

    def _change_status(self, request, desired):
        serializer = StatusChangeConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        department = _confirmed_call(
            confirm_department_status_change,
            department=self.get_object(),
            is_active=desired,
            impact_token=serializer.validated_data['impact_token'],
            **_actor_kwargs(request),
        )
        return Response(DepartmentReadSerializer(departments_queryset().get(pk=department.pk)).data)

    @action(detail=True, methods=['post'])
    def activate(self, request, public_id=None):
        return self._change_status(request, True)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, public_id=None):
        return self._change_status(request, False)

    @action(
        detail=True,
        methods=['get', 'post'],
        url_path='restore-system-default',
    )
    def restore_system_default(self, request, public_id=None):
        department = self.get_object()
        if request.method == 'GET':
            impact = restore_system_department_impact(department)
            if impact is None:
                raise ValidationError(
                    {'department': 'Phòng ban này không có cấu hình mặc định hệ thống.'}
                )
            return Response(impact)
        serializer = RestoreSystemDefaultConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        department = _confirmed_call(
            confirm_restore_system_department,
            department=department,
            impact_token=serializer.validated_data['impact_token'],
            **_actor_kwargs(request),
        )
        return Response(DepartmentReadSerializer(departments_queryset().get(pk=department.pk)).data)


class AdminRoleViewSet(viewsets.ModelViewSet):
    permission_classes = [HasAdminPermission]
    pagination_class = None
    lookup_field = 'public_id'
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']
    required_admin_permissions = {
        'list': ['admin_access.view'],
        'retrieve': ['admin_access.view'],
        'create': ['admin_access.manage_role'],
        'update': ['admin_access.manage_role'],
        'partial_update': ['admin_access.manage_role'],
        'activate': ['admin_access.manage_role'],
        'deactivate': ['admin_access.manage_role'],
        'status_impact': ['admin_access.manage_role'],
        'permissions': ['admin_access.manage_role'],
        'permissions_impact': ['admin_access.manage_role'],
        'restore_system_default': ['admin_access.manage_role'],
    }
    require_superuser = {
        'actions': {
            'create',
            'update',
            'partial_update',
            'activate',
            'deactivate',
            'status_impact',
            'permissions',
            'permissions_impact',
            'restore_system_default',
        }
    }

    def get_queryset(self):
        return roles_queryset(department_code=self.request.query_params.get('department'))

    def get_serializer_class(self):
        if self.action == 'create':
            return AdminRoleCreateSerializer
        if self.action in {'update', 'partial_update'}:
            return AdminRoleUpdateSerializer
        return AdminRoleReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = AdminRoleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        role = _call(
            create_role,
            department=validated['department'],
            code=validated['code'],
            name=validated['name'],
            description=validated.get('description', ''),
            rank=validated.get('rank', 0),
            **_actor_kwargs(request),
        )
        return Response(
            AdminRoleReadSerializer(roles_queryset().get(pk=role.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        role = self.get_object()
        serializer = AdminRoleUpdateSerializer(
            role,
            data=request.data,
            partial=kwargs.pop('partial', False),
        )
        serializer.is_valid(raise_exception=True)
        role = _call(
            update_role,
            role=role,
            name=serializer.validated_data.get('name', role.name),
            description=serializer.validated_data.get('description', role.description),
            rank=serializer.validated_data.get('rank', role.rank),
            **_actor_kwargs(request),
        )
        return Response(AdminRoleReadSerializer(roles_queryset().get(pk=role.pk)).data)

    @action(detail=True, methods=['post'], url_path='status-impact')
    def status_impact(self, request, public_id=None):
        serializer = StatusImpactRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            role_status_impact(
                self.get_object(),
                is_active=serializer.validated_data['is_active'],
            )
        )

    def _change_status(self, request, desired):
        serializer = StatusChangeConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = _confirmed_call(
            confirm_role_status_change,
            role=self.get_object(),
            is_active=desired,
            impact_token=serializer.validated_data['impact_token'],
            **_actor_kwargs(request),
        )
        return Response(AdminRoleReadSerializer(roles_queryset().get(pk=role.pk)).data)

    @action(detail=True, methods=['post'])
    def activate(self, request, public_id=None):
        return self._change_status(request, True)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, public_id=None):
        return self._change_status(request, False)

    @action(detail=True, methods=['post'], url_path='permissions-impact')
    def permissions_impact(self, request, public_id=None):
        serializer = RolePermissionImpactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            role_permissions_impact(
                self.get_object(),
                permission_codes=serializer.validated_data['permission_codes'],
            )
        )

    @action(detail=True, methods=['put'])
    def permissions(self, request, public_id=None):
        serializer = RolePermissionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = _confirmed_call(
            confirm_role_permissions_update,
            role=self.get_object(),
            permission_codes=serializer.validated_data['permission_codes'],
            impact_token=serializer.validated_data['impact_token'],
            **_actor_kwargs(request),
        )
        return Response(AdminRoleReadSerializer(roles_queryset().get(pk=role.pk)).data)

    @action(
        detail=True,
        methods=['get', 'post'],
        url_path='restore-system-default',
    )
    def restore_system_default(self, request, public_id=None):
        role = self.get_object()
        if request.method == 'GET':
            impact = restore_system_role_impact(role)
            if impact is None:
                raise ValidationError(
                    {'role': 'Chức danh này không có cấu hình mặc định hệ thống.'}
                )
            return Response(impact)
        serializer = RestoreSystemDefaultConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = _confirmed_call(
            confirm_restore_system_role,
            role=role,
            impact_token=serializer.validated_data['impact_token'],
            **_actor_kwargs(request),
        )
        return Response(AdminRoleReadSerializer(roles_queryset().get(pk=role.pk)).data)


class AdminPermissionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [HasAdminPermission]
    pagination_class = None
    serializer_class = AdminPermissionSerializer
    lookup_field = 'code'
    required_admin_permissions = {
        'list': ['admin_access.view'],
        'retrieve': ['admin_access.view'],
    }

    def get_queryset(self):
        role_public_id = self.request.query_params.get('role')
        role = None
        if role_public_id:
            try:
                role = AdminRole.objects.get(public_id=role_public_id)
            except AdminRole.DoesNotExist as error:
                raise NotFound('Không tìm thấy chức danh.') from error
        return permissions_queryset(role=role)


class AdminMembershipViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [HasAdminPermission]
    require_superuser = True
    lookup_field = 'public_id'
    required_admin_permissions = {
        'list': ['admin_access.view'],
        'retrieve': ['admin_access.view'],
        'create': ['admin_access.manage_staff'],
        'assignment_impact': ['admin_access.manage_staff'],
        'revoke': ['admin_access.manage_staff'],
        'revoke_impact': ['admin_access.manage_staff'],
    }

    def get_queryset(self):
        include_revoked = self.action != 'list' or self.request.query_params.get(
            'include_revoked', ''
        ).lower() in {'1', 'true', 'yes'}
        return memberships_queryset(
            department_code=self.request.query_params.get('department'),
            user_public_id=self.request.query_params.get('user'),
            include_revoked=include_revoked,
        )

    def get_serializer_class(self):
        return (
            AdminMembershipCreateSerializer
            if self.action == 'create'
            else AdminMembershipReadSerializer
        )

    def create(self, request, *args, **kwargs):
        serializer = AdminMembershipCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        membership = _confirmed_call(
            confirm_membership_assignment,
            user=data['user'],
            role=data['role'],
            impact_token=data['impact_token'],
            **_actor_kwargs(request),
        )
        return Response(
            AdminMembershipReadSerializer(
                memberships_queryset(include_revoked=True).get(pk=membership.pk)
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='assignment-impact')
    def assignment_impact(self, request):
        serializer = MembershipAssignmentImpactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not data['role'].is_active or not data['role'].department.is_active:
            raise ValidationError({'role_public_id': 'Chức danh hoặc phòng ban đang bị khoá.'})
        if not data['role'].permissions.filter(is_active=True).exists():
            raise ValidationError(
                {
                    'role_public_id': (
                        'Không thể gán nhân viên vào chức danh chưa có quyền hiệu lực.'
                    )
                }
            )
        if AdminMembership.objects.filter(
            user=data['user'],
            role=data['role'],
            is_active=True,
        ).exists():
            raise ValidationError({'role_public_id': 'Nhân viên đã có chức danh này.'})
        return Response(
            membership_assignment_impact(
                data['user'],
                data['role'],
            )
        )

    @action(detail=True, methods=['get'], url_path='revoke-impact')
    def revoke_impact(self, request, public_id=None):
        return Response(membership_revoke_impact(self.get_object()))

    @action(detail=True, methods=['post'])
    def revoke(self, request, public_id=None):
        serializer = MembershipActionConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = _confirmed_call(
            confirm_membership_revoke,
            membership=self.get_object(),
            impact_token=serializer.validated_data['impact_token'],
            **_actor_kwargs(request),
        )
        return Response(
            AdminMembershipReadSerializer(
                memberships_queryset(include_revoked=True).get(pk=membership.pk)
            ).data
        )


class AdminStaffViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [HasAdminPermission]
    require_superuser = True
    serializer_class = AdminStaffSerializer
    lookup_field = 'public_id'
    required_admin_permissions = {
        'list': ['admin_access.view'],
        'retrieve': ['admin_access.view'],
    }

    def get_queryset(self):
        return admin_staff_queryset(query=self.request.query_params.get('q', '').strip())


class AdminAuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Nhật ký hoạt động cho trang Cài đặt tài khoản.

    Mặc định chỉ trả log của chính người gọi nên mọi quản trị viên đều xem được,
    kể cả tài khoản chưa được gán phòng ban. ``?scope=all`` mở rộng ra toàn hệ
    thống và yêu cầu quyền ``audit_log.view`` — vì thế permission class là
    ``IsAdmin`` chứ không phải ``HasAdminPermission`` (class đó fail-closed khi
    view không khai báo sẵn permission code).
    """

    permission_classes = [IsAdmin]
    serializer_class = AdminAuditLogSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        params = self.request.query_params
        scope_is_all = params.get('scope') == 'all'
        if scope_is_all:
            require_admin_permission(self.request.user, 'audit_log.view')
        return audit_logs_queryset(
            actor=None if scope_is_all else self.request.user,
            action=params.get('action', '').strip(),
            target_type=params.get('target_type', '').strip(),
        )

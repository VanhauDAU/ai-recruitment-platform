from rest_framework import serializers

from ...constants import (
    ADMIN_PERMISSION_DEPENDENCIES,
    expand_admin_permission_codes,
    system_department_definition,
    system_role_definition,
)
from ...models import (
    AdminAccessAuditLog,
    AdminMembership,
    AdminPermission,
    AdminRole,
    Department,
    User,
)
from ...selectors import (
    MEMBERSHIP_DEFAULT_ORDERING,
    MEMBERSHIP_ORDERING_FIELDS,
    MEMBERSHIP_STATUS_CHOICES,
)


class StrippedTextMixin:
    def _strip(self, value):
        return value.strip() if isinstance(value, str) else value

    def validate_code(self, value):
        return self._strip(value)

    def validate_name(self, value):
        return self._strip(value)

    def validate_description(self, value):
        return self._strip(value)


class DepartmentReadSerializer(serializers.ModelSerializer):
    is_restorable = serializers.SerializerMethodField()
    role_count = serializers.IntegerField(read_only=True)
    active_member_count = serializers.IntegerField(read_only=True)
    revoked_member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Department
        fields = [
            'public_id',
            'code',
            'name',
            'description',
            'is_active',
            'is_system_managed',
            'is_restorable',
            'role_count',
            'active_member_count',
            'revoked_member_count',
        ]

    def get_is_restorable(self, obj):
        return system_department_definition(obj.code) is not None


class DepartmentCreateSerializer(StrippedTextMixin, serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['code', 'name', 'description']
        extra_kwargs = {
            'code': {'validators': []},
            'description': {'required': False, 'allow_blank': True},
        }


class DepartmentUpdateSerializer(StrippedTextMixin, serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['name', 'description']
        extra_kwargs = {'description': {'required': False, 'allow_blank': True}}


class AdminRoleReadSerializer(serializers.ModelSerializer):
    department = serializers.SerializerMethodField()
    is_restorable = serializers.SerializerMethodField()
    permission_codes = serializers.SlugRelatedField(
        source='permissions',
        slug_field='code',
        many=True,
        read_only=True,
    )
    active_member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = AdminRole
        fields = [
            'public_id',
            'department',
            'code',
            'name',
            'description',
            'rank',
            'is_active',
            'is_system_managed',
            'is_restorable',
            'permission_codes',
            'active_member_count',
        ]

    def get_department(self, obj):
        return {
            'public_id': obj.department.public_id,
            'code': obj.department.code,
            'name': obj.department.name,
        }

    def get_is_restorable(self, obj):
        return system_role_definition(obj.department.code, obj.code) is not None


class AdminRoleCreateSerializer(StrippedTextMixin, serializers.ModelSerializer):
    department = serializers.SlugRelatedField(
        slug_field='public_id',
        queryset=Department.objects.all(),
    )

    class Meta:
        model = AdminRole
        fields = ['department', 'code', 'name', 'description', 'rank']
        validators = []
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'rank': {'required': False},
        }


class AdminRoleUpdateSerializer(StrippedTextMixin, serializers.ModelSerializer):
    class Meta:
        model = AdminRole
        fields = ['name', 'description', 'rank']
        extra_kwargs = {'description': {'required': False, 'allow_blank': True}}


class AdminMembershipReadSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    assigned_by_email = serializers.EmailField(source='assigned_by.email', allow_null=True)

    class Meta:
        model = AdminMembership
        fields = [
            'public_id',
            'user',
            'department',
            'role',
            'is_active',
            'assigned_at',
            'revoked_at',
            'assigned_by_email',
        ]

    def get_user(self, obj):
        return {
            'public_id': obj.user.public_id,
            'email': obj.user.email,
            'full_name': obj.user.full_name,
            'two_factor_enabled': obj.user.two_factor_enabled,
        }

    def get_department(self, obj):
        return {
            'public_id': obj.role.department.public_id,
            'code': obj.role.department.code,
            'name': obj.role.department.name,
        }

    def get_role(self, obj):
        return {
            'public_id': obj.role.public_id,
            'code': obj.role.code,
            'name': obj.role.name,
            'rank': obj.role.rank,
        }


class AdminMembershipQuerySerializer(serializers.Serializer):
    q = serializers.CharField(
        allow_blank=True,
        max_length=120,
        required=False,
        trim_whitespace=True,
    )
    department = serializers.CharField(allow_blank=True, max_length=64, required=False)
    role = serializers.CharField(allow_blank=True, max_length=64, required=False)
    user = serializers.CharField(allow_blank=True, max_length=64, required=False)
    status = serializers.ChoiceField(choices=MEMBERSHIP_STATUS_CHOICES, required=False)
    include_revoked = serializers.BooleanField(required=False)
    ordering = serializers.ChoiceField(
        choices=[value for field in MEMBERSHIP_ORDERING_FIELDS for value in (field, f'-{field}')],
        default=MEMBERSHIP_DEFAULT_ORDERING,
        required=False,
    )
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(max_value=60, min_value=1, required=False)


class AdminMembershipCreateSerializer(serializers.Serializer):
    user_public_id = serializers.SlugRelatedField(
        source='user',
        slug_field='public_id',
        queryset=User.objects.filter(role=User.Role.ADMIN),
    )
    role_public_id = serializers.SlugRelatedField(
        source='role',
        slug_field='public_id',
        queryset=AdminRole.objects.select_related('department'),
    )
    impact_token = serializers.CharField(write_only=True, trim_whitespace=True)


class AdminPermissionSerializer(serializers.ModelSerializer):
    is_granted_to_role = serializers.SerializerMethodField()
    requires = serializers.SerializerMethodField()

    class Meta:
        model = AdminPermission
        fields = [
            'code',
            'module',
            'label',
            'description',
            'requires',
            'is_active',
            'is_granted_to_role',
        ]

    def get_is_granted_to_role(self, obj):
        return bool(getattr(obj, 'is_granted_to_role', False))

    def get_requires(self, obj):
        return list(ADMIN_PERMISSION_DEPENDENCIES.get(obj.code, ()))


class AdminStaffSerializer(serializers.ModelSerializer):
    active_membership_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = [
            'public_id',
            'email',
            'full_name',
            'two_factor_enabled',
            'active_membership_count',
        ]


class AdminAuditLogSerializer(serializers.ModelSerializer):
    """Một dòng nhật ký. ``actor_email`` rỗng khi thao tác đến từ CLI/seed."""

    actor_email = serializers.CharField(source='actor.email', default='', read_only=True)

    class Meta:
        model = AdminAccessAuditLog
        fields = [
            'public_id',
            'action',
            'source',
            'actor_email',
            'actor_identifier',
            'target_type',
            'target_public_id',
            'payload',
            'created_at',
        ]


class ImpactConfirmationSerializer(serializers.Serializer):
    impact_token = serializers.CharField(trim_whitespace=True)


class StatusChangeConfirmationSerializer(ImpactConfirmationSerializer):
    pass


class MembershipActionConfirmationSerializer(ImpactConfirmationSerializer):
    pass


class RestoreSystemDefaultConfirmationSerializer(ImpactConfirmationSerializer):
    pass


class StatusImpactRequestSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class PermissionCodesSerializer(serializers.Serializer):
    permission_codes = serializers.ListField(
        child=serializers.CharField(max_length=64, trim_whitespace=True),
        allow_empty=True,
    )

    def validate_permission_codes(self, value):
        codes = sorted(expand_admin_permission_codes(value))
        permissions = {
            permission.code: permission
            for permission in AdminPermission.objects.filter(code__in=codes)
        }
        missing = set(codes) - set(permissions)
        if missing:
            raise serializers.ValidationError(
                f'Permission không tồn tại: {", ".join(sorted(missing))}.'
            )
        inactive = {code for code, item in permissions.items() if not item.is_active}
        if inactive:
            raise serializers.ValidationError(
                f'Permission đã ngưng kích hoạt: {", ".join(sorted(inactive))}.'
            )
        return codes


class RolePermissionImpactSerializer(PermissionCodesSerializer):
    pass


class RolePermissionUpdateSerializer(PermissionCodesSerializer):
    impact_token = serializers.CharField(trim_whitespace=True)


class MembershipAssignmentImpactSerializer(serializers.Serializer):
    user_public_id = serializers.SlugRelatedField(
        source='user',
        slug_field='public_id',
        queryset=User.objects.filter(role=User.Role.ADMIN),
    )
    role_public_id = serializers.SlugRelatedField(
        source='role',
        slug_field='public_id',
        queryset=AdminRole.objects.select_related('department'),
    )

from decimal import Decimal

from rest_framework import serializers

from apps.employers.models import Company

from ...models import (
    JobServiceActivation,
    ServiceAuditEvent,
    ServiceCapability,
    ServiceEntitlementUnit,
    ServicePackage,
    ServicePackageVersion,
)
from ...selectors import (
    ENTITLEMENT_ORDERING_FIELDS,
    SERVICE_AUDIT_ORDERING_FIELDS,
)


def _ordering_choices(fields):
    return [value for field in fields for value in (field, f'-{field}')]


class AdminServiceCapabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCapability
        fields = [
            'code',
            'name_vi',
            'name_en',
            'description_vi',
            'scope',
            'effect_type',
            'is_active',
        ]


class AdminPackageVersionItemWriteSerializer(serializers.Serializer):
    capability = serializers.SlugRelatedField(
        slug_field='code',
        queryset=ServiceCapability.objects.filter(is_active=True),
    )
    quantity = serializers.IntegerField(min_value=1, max_value=1000, default=1)
    duration_days = serializers.IntegerField(
        min_value=1,
        max_value=3650,
        allow_null=True,
        required=False,
    )
    configuration = serializers.JSONField(default=dict)
    order = serializers.IntegerField(min_value=0, max_value=32767, required=False)


class AdminPackageVersionWriteSerializer(serializers.Serializer):
    package = serializers.PrimaryKeyRelatedField(queryset=ServicePackage.objects.all())
    price = serializers.DecimalField(
        max_digits=14,
        decimal_places=0,
        min_value=Decimal('0'),
    )
    currency = serializers.RegexField(r'^[A-Z]{3}$', default='VND')
    activate_within_days = serializers.IntegerField(min_value=1, max_value=3650, default=90)
    terms_vi = serializers.CharField(allow_blank=True, required=False, default='')
    terms_en = serializers.CharField(allow_blank=True, required=False, default='')
    items = AdminPackageVersionItemWriteSerializer(many=True, allow_empty=False)

    def validate_items(self, value):
        codes = [item['capability'].code for item in value]
        if len(codes) != len(set(codes)):
            raise serializers.ValidationError('Mỗi capability chỉ được xuất hiện một lần.')
        return value


class AdminPackageVersionItemSerializer(serializers.Serializer):
    capability = serializers.CharField(source='capability.code')
    capability_name = serializers.CharField(source='capability.name_vi')
    quantity = serializers.IntegerField()
    duration_days = serializers.IntegerField(allow_null=True)
    configuration = serializers.JSONField()
    order = serializers.IntegerField()


class AdminPackageVersionSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(max_digits=14, decimal_places=0)
    package_name = serializers.CharField(source='package.name_vi')
    package_slug = serializers.CharField(source='package.slug')
    items = AdminPackageVersionItemSerializer(many=True)

    class Meta:
        model = ServicePackageVersion
        fields = [
            'id',
            'package',
            'package_name',
            'package_slug',
            'version_number',
            'status',
            'price',
            'currency',
            'activate_within_days',
            'terms_vi',
            'terms_en',
            'items',
            'created_at',
            'updated_at',
            'published_at',
        ]


class AdminPackageVersionQuerySerializer(serializers.Serializer):
    package = serializers.IntegerField(min_value=1, required=False)
    status = serializers.ChoiceField(
        choices=ServicePackageVersion.Status.choices,
        required=False,
    )


class AdminEntitlementQuerySerializer(serializers.Serializer):
    company_public_id = serializers.CharField(max_length=50, required=False)
    status = serializers.ChoiceField(
        choices=ServiceEntitlementUnit.Status.choices,
        required=False,
    )
    ordering = serializers.ChoiceField(
        choices=_ordering_choices(ENTITLEMENT_ORDERING_FIELDS),
        default='-created_at',
        required=False,
    )


class AdminEntitlementGrantSerializer(serializers.Serializer):
    company_public_id = serializers.SlugRelatedField(
        source='company',
        slug_field='public_id',
        queryset=Company.objects.all(),
    )
    package_version = serializers.PrimaryKeyRelatedField(
        queryset=ServicePackageVersion.objects.select_related('package')
    )
    quantity = serializers.IntegerField(min_value=1, max_value=1000)
    grant_key = serializers.CharField(max_length=100, trim_whitespace=True)
    source = serializers.ChoiceField(
        choices=[
            ServiceEntitlementUnit.Source.MANUAL_GRANT,
            ServiceEntitlementUnit.Source.COMPENSATION,
        ],
        default=ServiceEntitlementUnit.Source.MANUAL_GRANT,
    )


class AdminEntitlementUnitSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source='company.public_id')
    company_name = serializers.CharField(source='company.company_name')
    package_name = serializers.CharField(source='package_version.package.name_vi')
    version_number = serializers.IntegerField(source='package_version.version_number')
    activation_public_id = serializers.SerializerMethodField()

    class Meta:
        model = ServiceEntitlementUnit
        fields = [
            'public_id',
            'company_public_id',
            'company_name',
            'package_version',
            'package_name',
            'version_number',
            'status',
            'source',
            'grant_key',
            'unit_number',
            'granted_at',
            'activate_by',
            'consumed_at',
            'expired_at',
            'revoked_at',
            'revoke_reason',
            'activation_public_id',
        ]

    def get_activation_public_id(self, obj):
        try:
            return obj.activation.public_id
        except JobServiceActivation.DoesNotExist:
            return None


class AdminEntitlementRevokeSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, trim_whitespace=True)


class AdminServiceAuditQuerySerializer(serializers.Serializer):
    company_public_id = serializers.CharField(max_length=50, required=False)
    event_type = serializers.ChoiceField(
        choices=ServiceAuditEvent.EventType.choices,
        required=False,
    )
    ordering = serializers.ChoiceField(
        choices=_ordering_choices(SERVICE_AUDIT_ORDERING_FIELDS),
        default='-occurred_at',
        required=False,
    )


class AdminServiceAuditSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source='actor.email', allow_null=True)
    company_public_id = serializers.CharField(source='company.public_id', allow_null=True)
    company_name = serializers.CharField(source='company.company_name', allow_null=True)
    package_name = serializers.CharField(
        source='package_version.package.name_vi',
        allow_null=True,
    )
    unit_public_id = serializers.CharField(source='unit.public_id', allow_null=True)
    activation_public_id = serializers.CharField(
        source='activation.public_id',
        allow_null=True,
    )

    class Meta:
        model = ServiceAuditEvent
        fields = [
            'public_id',
            'event_type',
            'occurred_at',
            'actor_email',
            'company_public_id',
            'company_name',
            'package_version',
            'package_name',
            'unit_public_id',
            'activation_public_id',
            'metadata',
        ]

from django.utils import timezone
from rest_framework import serializers

from apps.jobs.models import Job

from ...models import JobServiceActivation, JobServiceUsageEvent, ServiceEntitlementUnit


class EmployerServiceUnitSerializer(serializers.ModelSerializer):
    package_name = serializers.CharField(source='package_version.package.name_vi')
    version_number = serializers.IntegerField(source='package_version.version_number')
    items = serializers.JSONField(source='snapshot.items')
    is_activatable = serializers.SerializerMethodField()

    class Meta:
        model = ServiceEntitlementUnit
        fields = [
            'public_id',
            'package_name',
            'version_number',
            'status',
            'is_activatable',
            'activate_by',
            'items',
        ]

    def get_is_activatable(self, obj):
        return (
            obj.status == ServiceEntitlementUnit.Status.AVAILABLE
            and obj.activate_by >= timezone.now()
        )


class EmployerActivationRequestSerializer(serializers.Serializer):
    unit_public_id = serializers.SlugRelatedField(
        source='unit',
        slug_field='public_id',
        queryset=ServiceEntitlementUnit.objects.select_related(
            'company', 'package_version__package'
        ),
    )
    job_public_id = serializers.SlugRelatedField(
        source='job',
        slug_field='public_id',
        queryset=Job.objects.select_related('campaign'),
    )
    confirm_extension = serializers.BooleanField(default=False, required=False)


class EmployerActivationSerializer(serializers.ModelSerializer):
    unit_public_id = serializers.CharField(source='unit.public_id')
    job_public_id = serializers.CharField(source='job.public_id')
    job_title = serializers.CharField(source='job.title')
    package_name = serializers.CharField(source='unit.package_version.package.name_vi')
    items = serializers.SerializerMethodField()

    class Meta:
        model = JobServiceActivation
        fields = [
            'public_id',
            'unit_public_id',
            'job_public_id',
            'job_title',
            'package_name',
            'status',
            'starts_at',
            'ends_at',
            'items',
        ]

    def get_items(self, obj):
        return [
            {
                'capability': item.capability.code,
                'name': item.capability.name_vi,
                'quantity': item.total_quantity,
                'remaining_quantity': item.remaining_quantity,
                'starts_at': item.starts_at,
                'ends_at': item.ends_at,
            }
            for item in obj.items.all()
        ]


class EmployerUsageSerializer(serializers.ModelSerializer):
    activation_public_id = serializers.CharField(source='activation.public_id')
    remaining_quantity = serializers.IntegerField(source='activation_item.remaining_quantity')

    class Meta:
        model = JobServiceUsageEvent
        fields = [
            'public_id',
            'activation_public_id',
            'event_type',
            'occurred_at',
            'remaining_quantity',
        ]

from django.utils import timezone
from rest_framework import serializers

from apps.jobs.models import Job

from ...models import (
    JobServiceActivation,
    JobServiceAlertDispatch,
    JobServiceUsageEvent,
    ServiceEntitlementUnit,
)
from ...selectors import ACTIVATION_ORDERING_FIELDS


def _activation_ordering_choices():
    return [
        value
        for field in ACTIVATION_ORDERING_FIELDS
        for value in (field, f'-{field}')
        if field != 'company_name'
    ]


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


class EmployerActiveActivationQuerySerializer(serializers.Serializer):
    job_public_id = serializers.CharField(max_length=50, required=False)
    campaign_public_id = serializers.CharField(max_length=50, required=False)


class EmployerActivationHistoryQuerySerializer(EmployerActiveActivationQuerySerializer):
    status = serializers.ChoiceField(
        choices=JobServiceActivation.Status.choices,
        required=False,
    )
    ordering = serializers.ChoiceField(
        choices=_activation_ordering_choices(),
        default='-created_at',
        required=False,
    )


class EmployerActivationSerializer(serializers.ModelSerializer):
    unit_public_id = serializers.CharField(source='unit.public_id')
    job_public_id = serializers.CharField(source='job.public_id')
    job_title = serializers.CharField(source='job.title')
    job_status = serializers.CharField(source='job.status')
    package_name = serializers.CharField(source='unit.package_version.package.name_vi')
    package_slug = serializers.CharField(source='unit.package_version.package.slug')
    version_number = serializers.IntegerField(source='unit.package_version.version_number')
    campaign_public_id = serializers.SerializerMethodField()
    campaign_name = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    metrics = serializers.SerializerMethodField()
    is_effective = serializers.SerializerMethodField()

    class Meta:
        model = JobServiceActivation
        fields = [
            'public_id',
            'unit_public_id',
            'job_public_id',
            'job_title',
            'job_status',
            'campaign_public_id',
            'campaign_name',
            'package_name',
            'package_slug',
            'version_number',
            'status',
            'is_effective',
            'starts_at',
            'ends_at',
            'terminated_at',
            'termination_reason',
            'created_at',
            'updated_at',
            'items',
            'metrics',
        ]

    def get_campaign_public_id(self, obj):
        return obj.job.campaign.public_id if obj.job.campaign_id else None

    def get_campaign_name(self, obj):
        return obj.job.campaign.name if obj.job.campaign_id else None

    def get_items(self, obj):
        return [
            {
                'capability': item.capability.code,
                'name': item.capability.name_vi,
                'quantity': item.total_quantity,
                'remaining_quantity': item.remaining_quantity,
                'starts_at': item.starts_at,
                'ends_at': item.ends_at,
                'configuration': item.configuration,
            }
            for item in obj.items.all()
        ]

    def get_metrics(self, obj):
        return {
            'available': bool(getattr(obj, 'promotion_metric_days', 0)),
            'impressions': getattr(obj, 'promotion_impressions', 0),
            'views': getattr(obj, 'promotion_views', 0),
            'saves': getattr(obj, 'promotion_saves', 0),
            'applies': getattr(obj, 'promotion_applies', 0),
        }

    def get_is_effective(self, obj):
        now = timezone.now()
        return (
            obj.status == JobServiceActivation.Status.ACTIVE and obj.starts_at <= now < obj.ends_at
        )


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


class EmployerAlertDispatchSerializer(serializers.ModelSerializer):
    activation_public_id = serializers.CharField(source='activation.public_id')
    job_public_id = serializers.CharField(source='job.public_id')

    class Meta:
        model = JobServiceAlertDispatch
        fields = [
            'public_id',
            'activation_public_id',
            'job_public_id',
            'status',
            'selection_finished',
            'recipient_count',
            'sent_count',
            'cancelled_count',
            'failed_count',
            'created_at',
            'completed_at',
        ]

from django.utils.translation import gettext as _
from rest_framework import serializers

from ...models import EmployerActivity, EmployerNotification


class EmployerNotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = EmployerNotification
        fields = [
            'public_id',
            'event_type',
            'title',
            'message',
            'action_path',
            'metadata',
            'is_read',
            'read_at',
            'created_at',
        ]

    def get_is_read(self, obj) -> bool:
        return obj.read_at is not None


class EmployerActivitySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = EmployerActivity
        fields = [
            'public_id',
            'event_type',
            'summary',
            'subject_public_id',
            'metadata',
            'actor_name',
            'occurred_at',
        ]

    def get_actor_name(self, obj) -> str:
        if obj.actor is None:
            return _('Hệ thống')
        if obj.actor_id == obj.recipient_id:
            return _('Bạn')
        return _('Quản trị viên')


class EmployerNotificationPreferenceSerializer(serializers.Serializer):
    important_decision_email = serializers.BooleanField(read_only=True, default=True)
    intermediate_verification_email = serializers.BooleanField(required=False)
    new_application_email = serializers.BooleanField(required=False)
    campaign_weekly_report_email = serializers.BooleanField(required=False)

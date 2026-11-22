from django.utils.translation import gettext as _
from rest_framework import serializers

from ...models import EmployerActivity, EmployerNotification
from ...selectors import employer_activity_category


class EmployerNotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

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
            'category',
            'created_at',
        ]

    def get_is_read(self, obj) -> bool:
        return obj.read_at is not None

    def get_category(self, obj) -> str:
        return employer_activity_category(obj.event_type)


class EmployerActivitySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_kind = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    action_path = serializers.CharField(read_only=True, default='')

    class Meta:
        model = EmployerActivity
        fields = [
            'public_id',
            'event_type',
            'summary',
            'subject_public_id',
            'metadata',
            'actor_name',
            'actor_kind',
            'category',
            'action_path',
            'occurred_at',
        ]

    def get_actor_kind(self, obj) -> str:
        if obj.actor_id is None:
            return 'system'
        return 'self' if obj.actor_id == obj.recipient_id else 'admin'

    def get_actor_name(self, obj) -> str:
        return {
            'system': _('Hệ thống'),
            'self': _('Bạn'),
            'admin': _('Quản trị viên'),
        }[self.get_actor_kind(obj)]

    def get_category(self, obj) -> str:
        return employer_activity_category(obj.event_type)


class EmployerNotificationPreferenceSerializer(serializers.Serializer):
    important_decision_email = serializers.BooleanField(read_only=True, default=True)
    intermediate_verification_email = serializers.BooleanField(required=False)
    new_application_email = serializers.BooleanField(required=False)
    campaign_weekly_report_email = serializers.BooleanField(required=False)

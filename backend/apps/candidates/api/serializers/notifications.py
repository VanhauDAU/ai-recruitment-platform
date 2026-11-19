from rest_framework import serializers

from ...models import CandidateNotification


class CandidateNotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = CandidateNotification
        fields = [
            'public_id',
            'event_type',
            'title',
            'message',
            'action_path',
            'metadata',
            'is_read',
            'read_at',
            'delivered_at',
        ]
        read_only_fields = fields

    def get_is_read(self, obj) -> bool:
        return obj.read_at is not None

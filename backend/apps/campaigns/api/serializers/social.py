from rest_framework import serializers

from ...models import ScheduledSocialPost, SocialAccountConnection


class SocialConnectionSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    simulated = serializers.SerializerMethodField()

    class Meta:
        model = SocialAccountConnection
        fields = [
            'public_id',
            'provider',
            'simulated',
            'page_id',
            'page_name',
            'page_picture_url',
            'status',
            'status_label',
            'last_error_code',
            'connected_at',
        ]
        read_only_fields = fields

    def get_simulated(self, obj):
        return obj.provider == SocialAccountConnection.Provider.FAKE


class ScheduledPostSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    page_name = serializers.CharField(source='connection.page_name', read_only=True)

    class Meta:
        model = ScheduledSocialPost
        fields = [
            'public_id',
            'page_name',
            'message',
            'scheduled_for',
            'status',
            'status_label',
            'attempts',
            'last_error_code',
            'permalink',
            'published_at',
            'deleted_at',
        ]
        read_only_fields = fields


class SchedulePostSerializer(serializers.Serializer):
    connection = serializers.SlugRelatedField(
        slug_field='public_id', queryset=SocialAccountConnection.objects.all()
    )
    scheduled_for = serializers.DateTimeField(required=False, allow_null=True)
    message = serializers.CharField(required=False, allow_blank=True, max_length=5000)


class ReschedulePostSerializer(serializers.Serializer):
    scheduled_for = serializers.DateTimeField()


class SelectPageSerializer(serializers.Serializer):
    page_id = serializers.CharField(max_length=64)

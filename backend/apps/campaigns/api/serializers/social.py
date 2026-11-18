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


# What a recruiter can do about each failure code (Graph codes are prefixed graph_).
POST_ERROR_MESSAGES = {
    'graph_1500': 'Facebook không mở được link trong bài. Link phải là địa chỉ công khai, không phải localhost.',
    'graph_190': 'Kết nối Fanpage đã hết hạn. Hãy kết nối lại trong Cài đặt tài khoản.',
    'graph_102': 'Kết nối Fanpage đã hết hạn. Hãy kết nối lại trong Cài đặt tài khoản.',
    'graph_200': 'Fanpage chưa cho ProCV quyền đăng bài. Hãy kết nối lại và bật quyền đăng bài.',
    'graph_10': 'Fanpage chưa cho ProCV quyền đăng bài. Hãy kết nối lại và bật quyền đăng bài.',
    'graph_368': 'Facebook đang tạm chặn đăng bài từ Fanpage này. Hãy thử lại sau.',
    'graph_100': 'Facebook từ chối nội dung bài. Hãy sửa nội dung rồi đăng lại.',
    'timeout': 'Facebook không phản hồi kịp. Hệ thống đã thử lại nhiều lần.',
    'network_error': 'Không kết nối được tới Facebook. Hệ thống đã thử lại nhiều lần.',
    'campaign_paused': 'Chiến dịch đang tạm dừng nên bài được hoãn.',
    'campaign_ended': 'Chiến dịch đã kết thúc nên bài bị hủy.',
    'owner_changed': 'Chiến dịch đã bàn giao cho người khác nên bài bị hủy.',
    'connection_inactive': 'Fanpage đã ngắt kết nối. Hãy kết nối lại trong Cài đặt tài khoản.',
}


class ScheduledPostSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    page_name = serializers.CharField(source='connection.page_name', read_only=True)
    page_picture_url = serializers.CharField(source='connection.page_picture_url', read_only=True)
    error_message = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledSocialPost
        fields = [
            'public_id',
            'page_name',
            'page_picture_url',
            'message',
            'scheduled_for',
            'status',
            'status_label',
            'attempts',
            'last_error_code',
            'error_message',
            'permalink',
            'published_at',
            'deleted_at',
        ]
        read_only_fields = fields

    def get_error_message(self, obj):
        code = obj.last_error_code
        if not code:
            return ''
        return POST_ERROR_MESSAGES.get(code, f'Facebook báo lỗi ({code}). Hãy thử đăng lại.')


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

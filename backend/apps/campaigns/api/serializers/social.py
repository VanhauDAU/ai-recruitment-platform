from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework import serializers

from common.storage.media import media_public_url

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

    def get_simulated(self, obj) -> bool:
        return obj.provider == SocialAccountConnection.Provider.FAKE


# What a recruiter can do about each failure code (Graph codes are prefixed graph_).
POST_ERROR_MESSAGES = {
    'graph_1500': gettext_lazy(
        'Facebook không mở được link trong bài. Link phải là địa chỉ công khai, không phải localhost.'
    ),
    'graph_190': gettext_lazy(
        'Kết nối Fanpage đã hết hạn. Hãy kết nối lại trong Cài đặt tài khoản.'
    ),
    'graph_102': gettext_lazy(
        'Kết nối Fanpage đã hết hạn. Hãy kết nối lại trong Cài đặt tài khoản.'
    ),
    'graph_200': gettext_lazy(
        'Fanpage chưa cho ProCV quyền đăng bài. Hãy kết nối lại và bật quyền đăng bài.'
    ),
    'graph_10': gettext_lazy(
        'Fanpage chưa cho ProCV quyền đăng bài. Hãy kết nối lại và bật quyền đăng bài.'
    ),
    'graph_368': gettext_lazy('Facebook đang tạm chặn đăng bài từ Fanpage này. Hãy thử lại sau.'),
    'graph_100': gettext_lazy('Facebook từ chối nội dung bài. Hãy sửa nội dung rồi đăng lại.'),
    'timeout': gettext_lazy('Facebook không phản hồi kịp. Hệ thống đã thử lại nhiều lần.'),
    'network_error': gettext_lazy(
        'Không kết nối được tới Facebook. Hệ thống đã thử lại nhiều lần.'
    ),
    'campaign_paused': gettext_lazy('Chiến dịch đang tạm dừng nên bài được hoãn.'),
    'campaign_ended': gettext_lazy('Chiến dịch đã kết thúc nên bài bị hủy.'),
    'owner_changed': gettext_lazy('Chiến dịch đã bàn giao cho người khác nên bài bị hủy.'),
    'connection_inactive': gettext_lazy(
        'Fanpage đã ngắt kết nối. Hãy kết nối lại trong Cài đặt tài khoản.'
    ),
}


class ScheduledPostSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    page_name = serializers.CharField(source='connection.page_name', read_only=True)
    page_picture_url = serializers.CharField(source='connection.page_picture_url', read_only=True)
    error_message = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledSocialPost
        fields = [
            'public_id',
            'page_name',
            'page_picture_url',
            'message',
            'images',
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

    def get_images(self, obj) -> list[str]:
        request = self.context.get('request')
        return [media_public_url(path, request=request) for path in obj.images or []]

    def get_error_message(self, obj) -> str:
        code = obj.last_error_code
        if not code:
            return ''
        message = POST_ERROR_MESSAGES.get(code)
        if message is None:
            return _('Facebook báo lỗi (%(code)s). Hãy thử đăng lại.') % {'code': code}
        return str(message)


class SchedulePostSerializer(serializers.Serializer):
    connection = serializers.SlugRelatedField(
        slug_field='public_id', queryset=SocialAccountConnection.objects.all()
    )
    scheduled_for = serializers.DateTimeField(required=False, allow_null=True)
    message = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    images = serializers.ListField(
        child=serializers.CharField(max_length=500), required=False, max_length=4
    )


class ReschedulePostSerializer(serializers.Serializer):
    scheduled_for = serializers.DateTimeField()


class SelectPageSerializer(serializers.Serializer):
    page_id = serializers.CharField(max_length=64)

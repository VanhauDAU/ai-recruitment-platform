from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework import serializers

from common.storage.media import media_public_url

from ...models import ScheduledSocialPost, SocialAccountConnection


class SocialCapabilitiesSerializer(serializers.Serializer):
    max_chars = serializers.IntegerField()
    max_images = serializers.IntegerField()
    requires_image = serializers.BooleanField()
    supports_delete = serializers.BooleanField()
    image_ratio = serializers.ListField(child=serializers.FloatField(), allow_null=True)


class SocialNetworkSerializer(serializers.Serializer):
    key = serializers.CharField()
    platform = serializers.CharField()
    label = serializers.CharField()
    channel_kind = serializers.CharField()
    capabilities = SocialCapabilitiesSerializer()
    simulated = serializers.BooleanField()


class SocialConnectionSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    network_label = serializers.CharField(source='get_network_display', read_only=True)

    class Meta:
        model = SocialAccountConnection
        fields = [
            'public_id',
            'network',
            'network_label',
            'simulated',
            'account_id',
            'account_name',
            'account_picture_url',
            'status',
            'status_label',
            'last_error_code',
            'connected_at',
        ]
        read_only_fields = fields


# What a recruiter can do about each failure code (Graph codes are prefixed graph_).
POST_ERROR_MESSAGES = {
    'graph_1500': gettext_lazy(
        'Facebook không mở được link trong bài. Link phải là địa chỉ công khai, không phải localhost.'
    ),
    'graph_190': gettext_lazy('Kết nối đã hết hạn. Hãy kết nối lại trong Cài đặt tài khoản.'),
    'graph_102': gettext_lazy('Kết nối đã hết hạn. Hãy kết nối lại trong Cài đặt tài khoản.'),
    'graph_200': gettext_lazy(
        'Tài khoản chưa cho ProCV quyền đăng bài. Hãy kết nối lại và bật quyền đăng bài.'
    ),
    'graph_10': gettext_lazy(
        'Tài khoản chưa cho ProCV quyền đăng bài. Hãy kết nối lại và bật quyền đăng bài.'
    ),
    'graph_368': gettext_lazy(
        'Mạng xã hội đang tạm chặn đăng bài từ tài khoản này. Hãy thử lại sau.'
    ),
    'graph_100': gettext_lazy('Mạng xã hội từ chối nội dung bài. Hãy sửa nội dung rồi đăng lại.'),
    'timeout': gettext_lazy('Mạng xã hội không phản hồi kịp. Hệ thống đã thử lại nhiều lần.'),
    'network_error': gettext_lazy(
        'Không kết nối được tới mạng xã hội. Hệ thống đã thử lại nhiều lần.'
    ),
    'graph_9': gettext_lazy(
        'Tài khoản đã đăng quá số bài Instagram cho phép trong 24 giờ. Hệ thống sẽ thử lại sau.'
    ),
    'graph_9004': gettext_lazy('Instagram không tải được ảnh của bài. Hãy đổi ảnh rồi đăng lại.'),
    'container_error': gettext_lazy(
        'Mạng xã hội không xử lý được bài hoặc ảnh của bài. Hãy đổi ảnh rồi đăng lại.'
    ),
    'container_pending': gettext_lazy(
        'Mạng xã hội xử lý bài quá lâu. Hệ thống đã thử lại nhiều lần.'
    ),
    'image_required': gettext_lazy('Bài Instagram cần ít nhất một ảnh.'),
    'delete_unsupported': gettext_lazy(
        'Mạng xã hội này không cho gỡ bài tự động. Hãy mở bài và tự xóa.'
    ),
    'campaign_paused': gettext_lazy('Chiến dịch đang tạm dừng nên bài được hoãn.'),
    'campaign_ended': gettext_lazy('Chiến dịch đã kết thúc nên bài bị hủy.'),
    'owner_changed': gettext_lazy('Chiến dịch đã bàn giao cho người khác nên bài bị hủy.'),
    'connection_inactive': gettext_lazy(
        'Tài khoản đã ngắt kết nối. Hãy kết nối lại trong Cài đặt tài khoản.'
    ),
}


class ScheduledPostSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()
    queued = serializers.SerializerMethodField()
    network = serializers.CharField(source='connection.network', read_only=True)
    account_name = serializers.CharField(source='connection.account_name', read_only=True)
    account_picture_url = serializers.CharField(
        source='connection.account_picture_url', read_only=True
    )
    error_message = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledSocialPost
        fields = [
            'public_id',
            'network',
            'account_name',
            'account_picture_url',
            'message',
            'images',
            'scheduled_for',
            'status',
            'status_label',
            'queued',
            'attempts',
            'last_error_code',
            'error_message',
            'permalink',
            'published_at',
            'deleted_at',
        ]
        read_only_fields = fields

    def get_queued(self, obj) -> bool:
        """Due and waiting for the worker: shown as being published, not as scheduled."""
        now = timezone.now()
        return (
            obj.status == ScheduledSocialPost.Status.SCHEDULED
            and obj.scheduled_for <= now
            and (obj.next_attempt_at is None or obj.next_attempt_at <= now)
        )

    def get_status_label(self, obj) -> str:
        if self.get_queued(obj):
            return str(ScheduledSocialPost.Status.PUBLISHING.label)
        return obj.get_status_display()

    def get_images(self, obj) -> list[str]:
        request = self.context.get('request')
        return [media_public_url(path, request=request) for path in obj.images or []]

    def get_error_message(self, obj) -> str:
        code = obj.last_error_code
        if not code:
            return ''
        message = POST_ERROR_MESSAGES.get(code)
        if message is None:
            return _('%(network)s báo lỗi (%(code)s). Hãy thử đăng lại.') % {
                'network': obj.connection.spec.platform,
                'code': code,
            }
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


class SelectAccountSerializer(serializers.Serializer):
    account_id = serializers.CharField(max_length=64)

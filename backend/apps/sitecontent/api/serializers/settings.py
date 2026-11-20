from rest_framework import serializers

from common.storage.media import media_url_from_value

from ...models import Banner, Feedback, LinkGroup, SiteSetting
from ...selectors import resolve_link_group_items, setting_registry


class SiteSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSetting
        fields = ['key', 'label', 'group', 'value']


class AdminSiteSettingSerializer(serializers.ModelSerializer):
    """Bản đầy đủ cho trang quản trị: kèm metadata để tự render form và nút "?"."""

    default_value = serializers.SerializerMethodField()
    display_value = serializers.SerializerMethodField()
    options = serializers.SerializerMethodField()

    class Meta:
        model = SiteSetting
        fields = [
            'key',
            'label',
            'group',
            'section',
            'value',
            'default_value',
            'value_type',
            'options',
            'description',
            'help',
            'is_public',
            'order',
            'display_value',
            'updated_at',
        ]

    def get_options(self, obj) -> dict:
        return obj.resolved_options()

    def get_default_value(self, obj):
        """Seed default, for the "Đặt về mặc định" action; ``None`` for keys outside the seed."""
        row = setting_registry().get(obj.key)
        return row['value'] if row else None

    def get_display_value(self, obj):
        """URL chỉ để preview; ``value`` vẫn là storage key để PATCH an toàn."""
        if obj.value_type != SiteSetting.ValueType.IMAGE:
            return None
        return media_url_from_value(obj.value, request=self.context.get('request'))


class LinkGroupSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = LinkGroup
        fields = ['key', 'title', 'placement', 'source', 'items']

    def get_items(self, obj) -> list:
        return resolve_link_group_items(obj)


class BannerSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = [
            'id',
            'eyebrow',
            'title',
            'subtitle',
            'image_url',
            'theme',
            'cta_label',
            'cta_url',
        ]

    def get_image_url(self, obj) -> str:
        return media_url_from_value(obj.image_url, request=self.context.get('request'))


class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = [
            'id',
            'category',
            'content',
            'satisfaction',
            'phone',
            'email',
            'page_url',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'content': {'trim_whitespace': True, 'max_length': 2000},
        }

    def validate_content(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError('Mô tả góp ý cần ít nhất 10 ký tự.')
        return value.strip()

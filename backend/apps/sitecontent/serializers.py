import os

from rest_framework import serializers

from common.media_storage import media_url_from_value

from .models import Banner, LinkGroup, SiteSetting


class SiteSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSetting
        fields = ['key', 'label', 'group', 'value']


class AdminSiteSettingSerializer(serializers.ModelSerializer):
    """Bản đầy đủ cho trang quản trị: kèm metadata để tự render form.

    Với `value_type=env` chỉ trả về `env_configured` (có biến môi trường hay
    chưa), không bao giờ lộ giá trị secret.
    """

    env_configured = serializers.SerializerMethodField()
    display_value = serializers.SerializerMethodField()

    class Meta:
        model = SiteSetting
        fields = ['key', 'label', 'group', 'value', 'value_type', 'options',
                  'description', 'is_public', 'order', 'env_configured', 'display_value', 'updated_at']

    def get_env_configured(self, obj):
        if obj.value_type != SiteSetting.ValueType.ENV:
            return None
        return bool(os.environ.get(obj.options.get('env_var', '')))

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

    def get_items(self, obj):
        return obj.resolve_items()


class BannerSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = ['id', 'eyebrow', 'title', 'subtitle', 'image_url', 'theme', 'cta_label', 'cta_url']

    def get_image_url(self, obj):
        return media_url_from_value(obj.image_url, request=self.context.get('request'))

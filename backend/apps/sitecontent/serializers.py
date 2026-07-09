import os

from rest_framework import serializers

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

    class Meta:
        model = SiteSetting
        fields = ['key', 'label', 'group', 'value', 'value_type', 'options',
                  'description', 'is_public', 'order', 'env_configured', 'updated_at']

    def get_env_configured(self, obj):
        if obj.value_type != SiteSetting.ValueType.ENV:
            return None
        return bool(os.environ.get(obj.options.get('env_var', '')))


class LinkGroupSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = LinkGroup
        fields = ['key', 'title', 'placement', 'source', 'items']

    def get_items(self, obj):
        return obj.resolve_items()


class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ['id', 'eyebrow', 'title', 'subtitle', 'image_url', 'theme', 'cta_label', 'cta_url']

from rest_framework import serializers

from .models import Banner, LinkGroup, SiteSetting


class SiteSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSetting
        fields = ['key', 'label', 'group', 'value']


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

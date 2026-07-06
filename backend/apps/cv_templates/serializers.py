from rest_framework import serializers

from .models import CvTemplate


class CvTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CvTemplate
        fields = [
            'public_id', 'name', 'slug', 'category', 'description',
            'thumbnail_url', 'preview_url', 'layout_config', 'style_config',
            'is_premium', 'sort_order', 'usage_count',
        ]
        read_only_fields = fields

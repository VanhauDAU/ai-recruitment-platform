"""Admin contracts for the shared library: categories, colors and background images."""

from django.urls import reverse
from rest_framework import serializers

from apps.cvs.models import CvAsset

from ...models import CvCategory, CvColor


class CvCategoryAdminSerializer(serializers.ModelSerializer):
    # Số mẫu đang dùng (annotate ở viewset); mục đang dùng không xóa được.
    template_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CvCategory
        fields = [
            'id',
            'template_count',
            'public_id',
            'category_type',
            'name',
            'slug',
            'description',
            'sort_order',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['public_id', 'created_at', 'updated_at']


class CvColorAdminSerializer(serializers.ModelSerializer):
    # Số mẫu đang dùng (annotate ở viewset); mục đang dùng không xóa được.
    template_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CvColor
        fields = [
            'id',
            'template_count',
            'public_id',
            'name',
            'slug',
            'hex_code',
            'sort_order',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['public_id', 'created_at', 'updated_at']


class CvBackgroundAdminSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True, required=False)
    url = serializers.SerializerMethodField()

    class Meta:
        model = CvAsset
        fields = [
            'public_id',
            'title',
            'file',
            'content_type',
            'size_bytes',
            'width',
            'height',
            'is_active',
            'url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'public_id',
            'content_type',
            'size_bytes',
            'width',
            'height',
            'url',
            'created_at',
            'updated_at',
        ]

    def get_url(self, obj) -> str:
        path = reverse('cv-asset-content', kwargs={'asset_public_id': obj.public_id})
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path

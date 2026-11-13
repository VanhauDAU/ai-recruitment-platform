from rest_framework import serializers

from apps.accounts.permissions import require_admin_permission
from apps.cvs.models import CvAsset

from ...models import (
    CvCategory,
    CvColor,
    CvPositionProfile,
    CvSampleContent,
    CvTemplate,
    CvTemplateVersion,
)

PROTECTED_LIFECYCLE_FIELDS = {
    'CvTemplate': ('lifecycle_status', 'current_published_version'),
    'CvCategory': ('is_active',),
    'CvColor': ('is_active',),
    'CvAsset': ('is_active',),
    'CvSampleContent': ('status', 'published_at'),
}


def _is_published_state(field, value):
    if field == 'is_active':
        return value is True
    if field in {'status', 'lifecycle_status'}:
        return value == 'published'
    return value is not None


class LifecycleFieldGuardMixin:
    """Protect public lifecycle transitions independently from edit access."""

    def _lifecycle_fields(self):
        return PROTECTED_LIFECYCLE_FIELDS.get(self.Meta.model.__name__, ())

    def validate(self, attrs):
        request = self.context.get('request')
        if request is None:
            return super().validate(attrs)

        for field in self._lifecycle_fields():
            if field not in attrs:
                continue
            after = attrs[field]
            if self.instance is None:
                if _is_published_state(field, after):
                    require_admin_permission(request.user, 'cv_template.publish')
                continue

            before = getattr(self.instance, field)
            if before == after:
                continue
            required = (
                'cv_template.publish'
                if _is_published_state(field, after)
                else 'cv_template.archive'
            )
            require_admin_permission(request.user, required)
        return super().validate(attrs)


class CvTemplateVersionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = CvTemplateVersion
        exclude = ['template', 'created_by']
        read_only_fields = [
            'version_number',
            'version_status',
            'published_at',
            'retired_at',
            'created_at',
        ]


class CvTemplateAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
    versions = CvTemplateVersionAdminSerializer(many=True, read_only=True)
    current_published_version_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = CvTemplate
        fields = [
            'public_id',
            'name',
            'slug',
            'display_name_vi',
            'display_name_en',
            'description_vi',
            'description_en',
            'seo_title_vi',
            'seo_title_en',
            'seo_description_vi',
            'seo_description_en',
            'is_premium',
            'sort_order',
            'lifecycle_status',
            'current_published_version_id',
            'versions',
        ]
        read_only_fields = ['public_id', 'lifecycle_status', 'current_published_version_id']


class CvCategoryAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
    class Meta:
        model = CvCategory
        fields = '__all__'
        read_only_fields = ['public_id', 'created_at', 'updated_at']


class CvColorAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
    class Meta:
        model = CvColor
        fields = '__all__'
        read_only_fields = ['public_id', 'created_at', 'updated_at']


class CvBackgroundAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
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

    def get_url(self, obj):
        from django.urls import reverse

        path = reverse('cv-v2-asset-content', kwargs={'asset_public_id': obj.public_id})
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path


class PositionProfileField(serializers.SlugRelatedField):
    """Nhận và trả mã `JobCategory` thay cho khóa nội bộ của `CvPositionProfile`."""

    def to_representation(self, obj):
        return obj.job_category.public_id


class CvSampleContentAdminSerializer(LifecycleFieldGuardMixin, serializers.ModelSerializer):
    # Mã `JobCategory` của vị trí (null = nội dung chung, có thể chứa `{position}`).
    position_public_id = PositionProfileField(
        source='position_profile',
        slug_field='job_category__public_id',
        queryset=CvPositionProfile.objects.select_related('job_category'),
        allow_null=True,
        required=False,
    )
    position_name = serializers.CharField(
        source='position_profile.job_category.name', read_only=True, default=''
    )

    class Meta:
        model = CvSampleContent
        fields = [
            'public_id',
            'position_public_id',
            'position_name',
            'locale',
            'experience_band',
            'title',
            'content_json',
            'schema_version',
            'status',
            'published_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['public_id', 'status', 'published_at', 'created_at', 'updated_at']

    def validate(self, attrs):
        instance = self.instance
        locale = attrs.get('locale', instance.locale if instance else None)
        content = attrs.get('content_json', instance.content_json if instance else {})
        if content.get('locale') != locale:
            raise serializers.ValidationError(
                {'content_json': 'content_json.locale must match locale.'}
            )
        return super().validate(attrs)

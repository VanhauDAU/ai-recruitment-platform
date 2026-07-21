from rest_framework import serializers

from apps.cvs.models import CvAsset
from apps.jobs.models import JobCategory

from .models import (
    CvCategory,
    CvColor,
    CvContentBlueprint,
    CvSampleContent,
    CvTemplate,
    CvTemplateLocalization,
    CvTemplateVersion,
)


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


class CvTemplateLocalizationAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = CvTemplateLocalization
        fields = '__all__'
        read_only_fields = ['locale_ref']


class CvTemplateAdminSerializer(serializers.ModelSerializer):
    versions = CvTemplateVersionAdminSerializer(many=True, read_only=True)
    localizations = CvTemplateLocalizationAdminSerializer(many=True, read_only=True)
    current_published_version_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = CvTemplate
        fields = [
            'public_id',
            'name',
            'slug',
            'description',
            'thumbnail_url',
            'preview_url',
            'is_premium',
            'status',
            'sort_order',
            'lifecycle_status',
            'current_published_version_id',
            'versions',
            'localizations',
        ]
        read_only_fields = ['public_id', 'lifecycle_status', 'current_published_version_id']


class CvCategoryAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = CvCategory
        fields = '__all__'
        read_only_fields = ['public_id', 'created_at', 'updated_at']


class CvColorAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = CvColor
        fields = '__all__'
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

    def get_url(self, obj):
        from django.urls import reverse

        path = reverse('cv-v2-asset-content', kwargs={'asset_public_id': obj.public_id})
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path


class CvSampleContentAdminSerializer(serializers.ModelSerializer):
    job_category_public_id = serializers.SlugRelatedField(
        source='job_category',
        slug_field='public_id',
        queryset=JobCategory.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = CvSampleContent
        fields = [
            'public_id',
            'job_category_public_id',
            'locale',
            'experience_level',
            'title',
            'position_name_vi',
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
        return attrs


class CvContentBlueprintAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = CvContentBlueprint
        fields = [
            'public_id',
            'locale',
            'experience_level',
            'content_json_template',
            'summary_title',
            'summary_template',
            'experience_title',
            'experience_company',
            'experience_description_template',
            'education_title',
            'education_degree',
            'education_institution',
            'education_description',
            'skills_title',
            'skill_templates',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['public_id', 'created_at', 'updated_at']

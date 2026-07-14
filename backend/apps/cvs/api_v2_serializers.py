"""Request/response contracts for the CV lifecycle V2 API."""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.cv_templates.models import CvSampleContent, CvTemplate

from .models import CvDraft, CvVersion, UserCv
from .schemas import validate_cv_document


class CvV2Serializer(serializers.ModelSerializer):
    template_public_id = serializers.CharField(source='template.public_id', read_only=True)
    template_version = serializers.CharField(source='current_template_version.renderer_key', read_only=True)
    template_renderer_key = serializers.CharField(source='current_template_version.renderer_key', read_only=True)
    template_renderer_version = serializers.CharField(source='current_template_version.renderer_version', read_only=True)
    latest_version_public_id = serializers.CharField(source='latest_version.public_id', read_only=True)
    published_version_public_id = serializers.CharField(source='published_version.public_id', read_only=True)

    class Meta:
        model = UserCv
        fields = [
            'public_id', 'title', 'language', 'cv_type', 'source',
            'template_public_id', 'template_version', 'lifecycle_status',
            'template_renderer_key', 'template_renderer_version',
            'processing_status', 'visibility', 'latest_version_public_id',
            'published_version_public_id', 'published_at', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class CvV2CreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    template_public_id = serializers.CharField(max_length=50)
    language = serializers.CharField(max_length=16, default='vi-VN')
    sample_content_public_id = serializers.CharField(max_length=50, required=False, allow_blank=False)

    def validate_template_public_id(self, value):
        try:
            return CvTemplate.objects.select_related('current_published_version').get(public_id=value)
        except CvTemplate.DoesNotExist as error:
            raise serializers.ValidationError('Unknown template.') from error

    def validate_sample_content_public_id(self, value):
        try:
            return CvSampleContent.objects.get(public_id=value)
        except CvSampleContent.DoesNotExist as error:
            raise serializers.ValidationError('Unknown sample content.') from error

    def validate(self, attrs):
        sample_content = attrs.get('sample_content_public_id')
        if sample_content is not None and sample_content.locale != attrs['language']:
            raise serializers.ValidationError({'sample_content_public_id': 'Sample locale must match language.'})
        return attrs


class CvDraftSerializer(serializers.ModelSerializer):
    base_version_public_id = serializers.CharField(source='base_version.public_id', read_only=True)

    class Meta:
        model = CvDraft
        fields = [
            'schema_version', 'content_json', 'layout_json', 'style_json',
            'lock_version', 'base_version_public_id', 'updated_at',
        ]
        read_only_fields = ['lock_version', 'base_version_public_id', 'updated_at']


class CvDraftWriteSerializer(serializers.Serializer):
    schema_version = serializers.IntegerField(default=1)
    content_json = serializers.JSONField()
    layout_json = serializers.JSONField()
    style_json = serializers.JSONField()
    client_session_id = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate(self, attrs):
        try:
            validate_cv_document(
                content_json=attrs['content_json'],
                layout_json=attrs['layout_json'],
                style_json=attrs['style_json'],
                schema_version=attrs['schema_version'],
            )
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.message_dict if hasattr(error, 'message_dict') else error.messages) from error
        return attrs


class CvVersionSerializer(serializers.ModelSerializer):
    template_renderer_key = serializers.CharField(source='template_version.renderer_key', read_only=True)
    parent_version_public_id = serializers.CharField(source='parent_version.public_id', read_only=True)

    class Meta:
        model = CvVersion
        fields = [
            'public_id', 'version_number', 'version_kind', 'schema_version',
            'content_json', 'layout_json', 'style_json', 'plain_text',
            'content_hash', 'template_renderer_key', 'parent_version_public_id',
            'created_at',
        ]
        read_only_fields = fields

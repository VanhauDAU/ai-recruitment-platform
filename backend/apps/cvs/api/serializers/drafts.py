"""Draft contracts: the autosave document, its write payload and draft-wide actions."""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.cv_templates.models import validate_cv_document
from apps.cvs.models import CvDraft
from apps.cvs.services.assets import asset_map

from .lookups import THEME_COLOR_PATTERN


class CvDraftSerializer(serializers.ModelSerializer):
    base_version_public_id = serializers.CharField(source='base_version.public_id', read_only=True)
    assets = serializers.SerializerMethodField()

    class Meta:
        model = CvDraft
        fields = [
            'schema_version',
            'content_json',
            'layout_json',
            'style_json',
            'assets',
            'lock_version',
            'base_version_public_id',
            'updated_at',
        ]
        read_only_fields = ['lock_version', 'base_version_public_id', 'updated_at']

    def get_assets(self, obj) -> dict:
        return asset_map(
            content_json=obj.content_json,
            style_json=obj.style_json,
            request=self.context.get('request'),
            owner=obj.cv.user,
            signed=True,
        )


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
            raise serializers.ValidationError(
                error.message_dict if hasattr(error, 'message_dict') else error.messages
            ) from error
        return attrs


class CvTemplateSwitchSerializer(serializers.Serializer):
    template_public_id = serializers.CharField(max_length=50)
    theme_color = serializers.RegexField(THEME_COLOR_PATTERN, required=False)
    client_session_id = serializers.CharField(max_length=100, required=False, allow_blank=True)


class CvApplySampleSerializer(serializers.Serializer):
    sample_content_public_id = serializers.CharField(max_length=50)
    client_session_id = serializers.CharField(max_length=100, required=False, allow_blank=True)

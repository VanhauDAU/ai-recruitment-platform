"""Immutable version contracts for the owner, history cards and bearer-link readers."""

from rest_framework import serializers

from apps.cvs.models import CvVersion
from apps.cvs.services.assets import asset_map


class CvVersionSerializer(serializers.ModelSerializer):
    template_renderer_key = serializers.CharField(
        source='template_version.renderer_key', read_only=True
    )
    parent_version_public_id = serializers.CharField(
        source='parent_version.public_id', read_only=True
    )
    assets = serializers.SerializerMethodField()
    # True when this snapshot is an uploaded file: readers show that file, not
    # the (empty) structured document. The storage key itself is never exposed.
    has_source_file = serializers.SerializerMethodField()

    class Meta:
        model = CvVersion
        fields = [
            'public_id',
            'version_number',
            'version_kind',
            'schema_version',
            'content_json',
            'layout_json',
            'style_json',
            'assets',
            'has_source_file',
            'plain_text',
            'content_hash',
            'template_renderer_key',
            'parent_version_public_id',
            'created_at',
        ]
        read_only_fields = fields

    def get_has_source_file(self, obj) -> bool:
        return bool(obj.source_file_key)

    def get_assets(self, obj) -> dict:
        return asset_map(
            content_json=obj.content_json,
            style_json=obj.style_json,
            request=self.context.get('request'),
            owner=obj.cv.user if obj.cv_id else None,
            version=obj,
            signed=True,
            token_context=self.context.get('asset_token_context'),
        )


class CvVersionSummarySerializer(serializers.ModelSerializer):
    """Small immutable history card used by owner export/version selection."""

    template_renderer_key = serializers.CharField(
        source='template_version.renderer_key', read_only=True
    )
    template_renderer_version = serializers.CharField(
        source='template_version.renderer_version', read_only=True
    )

    class Meta:
        model = CvVersion
        fields = [
            'public_id',
            'version_number',
            'version_kind',
            'schema_version',
            'template_renderer_key',
            'template_renderer_version',
            'created_at',
        ]
        read_only_fields = fields


class SharedCvVersionSerializer(serializers.ModelSerializer):
    """Bearer-link response: canonical rendering data only, never draft or hashes."""

    template_renderer_key = serializers.CharField(
        source='template_version.renderer_key', read_only=True
    )
    template_renderer_version = serializers.CharField(
        source='template_version.renderer_version', read_only=True
    )
    assets = serializers.SerializerMethodField()

    class Meta:
        model = CvVersion
        fields = [
            'public_id',
            'version_number',
            'schema_version',
            'content_json',
            'layout_json',
            'style_json',
            'assets',
            'template_renderer_key',
            'template_renderer_version',
            'created_at',
        ]
        read_only_fields = fields

    def get_assets(self, obj) -> dict:
        return asset_map(
            content_json=obj.content_json,
            style_json=obj.style_json,
            request=self.context.get('request'),
            version=obj,
            signed=True,
        )

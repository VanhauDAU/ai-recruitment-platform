"""Request/response contracts for the CV lifecycle V2 API."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from apps.cv_templates.models import CvSampleContent, CvTemplate
from apps.jobs.models import JobCategory
from apps.sitecontent.selectors import is_active_locale

from .completeness import COMPLETION_THRESHOLD, cv_completion_score
from .models import CvAsset, CvDraft, CvExport, CvImportJob, CvSharedLink, CvVersion, UserCv
from .schemas import validate_cv_document
from .services.assets import asset_map, sign_asset


class CvV2Serializer(serializers.ModelSerializer):
    template_public_id = serializers.CharField(source='template.public_id', read_only=True)
    template_version = serializers.CharField(
        source='current_template_version.renderer_key', read_only=True
    )
    template_renderer_key = serializers.CharField(
        source='current_template_version.renderer_key', read_only=True
    )
    template_renderer_version = serializers.CharField(
        source='current_template_version.renderer_version', read_only=True
    )
    template_capabilities = serializers.JSONField(
        source='current_template_version.capabilities', read_only=True
    )
    latest_version_public_id = serializers.CharField(
        source='latest_version.public_id', read_only=True
    )
    published_version_public_id = serializers.CharField(
        source='published_version.public_id', read_only=True
    )
    position_public_id = serializers.CharField(
        source='position.public_id', read_only=True, allow_null=True
    )
    has_unsaved_changes = serializers.SerializerMethodField()
    draft_updated_at = serializers.SerializerMethodField()
    import_job = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    thumbnail_status = serializers.SerializerMethodField()
    completion_score = serializers.SerializerMethodField()
    is_complete = serializers.SerializerMethodField()

    class Meta:
        model = UserCv
        fields = [
            'public_id',
            'title',
            'language',
            'cv_type',
            'source',
            'file_name',
            'file_type',
            'is_default',
            'position_public_id',
            'template_public_id',
            'template_version',
            'lifecycle_status',
            'template_renderer_key',
            'template_renderer_version',
            'template_capabilities',
            'processing_status',
            'visibility',
            'latest_version_public_id',
            'published_version_public_id',
            'published_at',
            'archived_at',
            'created_at',
            'updated_at',
            'has_unsaved_changes',
            'draft_updated_at',
            'completion_score',
            'is_complete',
            'import_job',
            'thumbnail_url',
            'thumbnail_status',
        ]
        read_only_fields = fields

    def get_has_unsaved_changes(self, obj):
        try:
            draft = obj.draft
        except CvDraft.DoesNotExist:
            return False
        return (
            draft.base_version_id is None or draft.document_hash != draft.base_version.content_hash
        )

    def get_draft_updated_at(self, obj):
        try:
            return obj.draft.updated_at
        except CvDraft.DoesNotExist:
            return None

    def get_completion_score(self, obj):
        return cv_completion_score(obj)

    def get_is_complete(self, obj):
        return cv_completion_score(obj) >= COMPLETION_THRESHOLD

    def get_import_job(self, obj):
        try:
            job = obj.import_job
        except CvImportJob.DoesNotExist:
            return None
        return {
            'public_id': job.public_id,
            'status': job.status,
            'attempts': job.attempts,
            'failure_code': job.failure_code,
        }

    def get_thumbnail_url(self, obj):
        from django.urls import reverse

        from .services import current_thumbnail_ready

        if not current_thumbnail_ready(obj):
            return None
        path = reverse('cv-v2-thumbnail', kwargs={'public_id': obj.public_id})
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path

    def get_thumbnail_status(self, obj):
        from .services import current_thumbnail_ready

        return 'ready' if current_thumbnail_ready(obj) else 'pending'


class CvV2MetadataUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False, trim_whitespace=True)
    is_default = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('Provide at least one mutable field.')
        return attrs


class CvV2ImportSerializer(serializers.Serializer):
    file = serializers.FileField()
    title = serializers.CharField(
        max_length=255, required=False, allow_blank=False, trim_whitespace=True
    )
    template_public_id = serializers.CharField(max_length=50, required=False)
    language = serializers.CharField(max_length=16, default='vi-VN')
    theme_color = serializers.RegexField(r'^#[0-9A-Fa-f]{6}$', required=False)

    def validate_file(self, value):
        from .services.imports import InvalidCvImport, validate_import_upload

        try:
            validate_import_upload(value)
        except InvalidCvImport as error:
            raise serializers.ValidationError(str(error)) from error
        return value

    def validate_template_public_id(self, value):
        try:
            return CvTemplate.objects.select_related('current_published_version').get(
                public_id=value
            )
        except CvTemplate.DoesNotExist as error:
            raise serializers.ValidationError('Unknown template.') from error

    def validate_language(self, value):
        if not is_active_locale(value):
            raise serializers.ValidationError('Unknown or inactive locale.')
        return value

    def validate(self, attrs):
        template = attrs.get('template_public_id')
        theme_color = attrs.get('theme_color')
        if theme_color and template is None:
            raise serializers.ValidationError({'theme_color': 'template_public_id is required.'})
        if (
            theme_color
            and not template.color_links.filter(
                color__hex_code__iexact=theme_color,
                color__is_active=True,
            ).exists()
        ):
            raise serializers.ValidationError(
                {'theme_color': 'Color is not available for this template.'}
            )
        if theme_color:
            attrs['theme_color'] = theme_color.upper()
        return attrs


class CvV2DuplicateSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255, required=False, allow_blank=False, trim_whitespace=True
    )


class CvV2CreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    template_public_id = serializers.CharField(max_length=50)
    language = serializers.CharField(max_length=16, default='vi-VN')
    sample_content_public_id = serializers.CharField(
        max_length=50, required=False, allow_blank=False
    )
    position_public_id = serializers.CharField(max_length=50, required=False, allow_blank=False)
    source_cv_public_id = serializers.CharField(max_length=50, required=False, allow_blank=False)
    theme_color = serializers.RegexField(r'^#[0-9A-Fa-f]{6}$', required=False)

    def validate_language(self, value):
        if not is_active_locale(value):
            raise serializers.ValidationError('Unknown or inactive locale.')
        return value

    def validate_template_public_id(self, value):
        try:
            return CvTemplate.objects.select_related('current_published_version').get(
                public_id=value
            )
        except CvTemplate.DoesNotExist as error:
            raise serializers.ValidationError('Unknown template.') from error

    def validate_sample_content_public_id(self, value):
        try:
            return CvSampleContent.objects.get(public_id=value)
        except CvSampleContent.DoesNotExist as error:
            raise serializers.ValidationError('Unknown sample content.') from error

    def validate_position_public_id(self, value):
        try:
            return JobCategory.objects.get(
                public_id=value,
                status=JobCategory.Status.ACTIVE,
                category_type=JobCategory.CategoryType.SPECIALIZATION,
            )
        except JobCategory.DoesNotExist as error:
            raise serializers.ValidationError('Unknown active specialization.') from error

    def validate_source_cv_public_id(self, value):
        try:
            return UserCv.objects.select_related('latest_version', 'position').get(
                public_id=value,
                user=self.context['request'].user,
                is_deleted=False,
            )
        except UserCv.DoesNotExist as error:
            raise serializers.ValidationError('Unknown reusable CV.') from error

    def validate(self, attrs):
        sample_content = attrs.get('sample_content_public_id')
        position = attrs.get('position_public_id')
        source_cv = attrs.get('source_cv_public_id')
        selected_sources = [
            value for value in (sample_content, position, source_cv) if value is not None
        ]
        if len(selected_sources) > 1:
            raise serializers.ValidationError(
                {
                    'position_public_id': 'Use only one content source.',
                }
            )
        if sample_content is not None and sample_content.locale != attrs['language']:
            raise serializers.ValidationError(
                {'sample_content_public_id': 'Sample locale must match language.'}
            )
        theme_color = attrs.get('theme_color')
        template = attrs['template_public_id']
        if (
            theme_color
            and not template.color_links.filter(
                color__hex_code__iexact=theme_color,
                color__is_active=True,
            ).exists()
        ):
            raise serializers.ValidationError(
                {'theme_color': 'Color is not available for this template.'}
            )
        if theme_color:
            attrs['theme_color'] = theme_color.upper()
        return attrs


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

    def get_assets(self, obj):
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
    theme_color = serializers.RegexField(r'^#[0-9A-Fa-f]{6}$', required=False)
    client_session_id = serializers.CharField(max_length=100, required=False, allow_blank=True)


class CvApplySampleSerializer(serializers.Serializer):
    sample_content_public_id = serializers.CharField(max_length=50)
    client_session_id = serializers.CharField(max_length=100, required=False, allow_blank=True)


class CvAssetUploadSerializer(serializers.Serializer):
    file = serializers.FileField()


class CvAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = CvAsset
        fields = [
            'public_id',
            'kind',
            'title',
            'content_type',
            'size_bytes',
            'width',
            'height',
            'url',
        ]
        read_only_fields = fields

    def get_url(self, obj):
        from django.urls import reverse

        path = reverse('cv-v2-asset-content', kwargs={'asset_public_id': obj.public_id})
        if obj.kind == CvAsset.Kind.AVATAR:
            path = f'{path}?token={sign_asset(obj)}'
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path


class CvSharedLinkCreateSerializer(serializers.Serializer):
    version_public_id = serializers.CharField(max_length=50, required=False, allow_blank=False)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_expires_at(self, value):
        if value is not None and value <= timezone.now():
            raise serializers.ValidationError('Expiry must be in the future.')
        return value


class CvSharedLinkSerializer(serializers.ModelSerializer):
    version_public_id = serializers.CharField(source='version.public_id', read_only=True)

    class Meta:
        model = CvSharedLink
        fields = [
            'public_id',
            'version_public_id',
            'expires_at',
            'revoked_at',
            'last_accessed_at',
            'created_at',
        ]
        read_only_fields = fields


class CvExportCreateSerializer(serializers.Serializer):
    """The version is optional; service defaults to published then latest."""

    version_public_id = serializers.CharField(max_length=50, required=False, allow_blank=False)


class CvExportSerializer(serializers.ModelSerializer):
    version_public_id = serializers.CharField(source='version.public_id', read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = CvExport
        fields = [
            'public_id',
            'version_public_id',
            'export_format',
            'status',
            'renderer_key',
            'renderer_version',
            'attempts',
            'download_url',
            'queued_at',
            'started_at',
            'completed_at',
            'failed_at',
            'created_at',
        ]
        read_only_fields = fields

    def get_download_url(self, obj):
        from django.urls import reverse

        from .services import export_download_ready

        if not export_download_ready(obj):
            return None
        url = reverse(
            'cv-v2-export-download',
            kwargs={
                'public_id': obj.cv.public_id,
                'export_public_id': obj.public_id,
            },
        )
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url


class CvVersionSerializer(serializers.ModelSerializer):
    template_renderer_key = serializers.CharField(
        source='template_version.renderer_key', read_only=True
    )
    parent_version_public_id = serializers.CharField(
        source='parent_version.public_id', read_only=True
    )
    assets = serializers.SerializerMethodField()

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
            'plain_text',
            'content_hash',
            'template_renderer_key',
            'parent_version_public_id',
            'created_at',
        ]
        read_only_fields = fields

    def get_assets(self, obj):
        return asset_map(
            content_json=obj.content_json,
            style_json=obj.style_json,
            request=self.context.get('request'),
            owner=obj.cv.user if obj.cv_id else None,
            version=obj,
            signed=True,
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

    def get_assets(self, obj):
        return asset_map(
            content_json=obj.content_json,
            style_json=obj.style_json,
            request=self.context.get('request'),
            version=obj,
            signed=True,
        )

"""CV library contracts: the CV card/detail and its create, metadata and duplicate requests."""

from datetime import datetime

from django.urls import reverse
from rest_framework import serializers

from apps.cv_templates.models import (
    DEFAULT_CV_LANGUAGE,
    DEFAULT_EXPERIENCE_BAND,
    CvLanguage,
    ExperienceBand,
)
from apps.cvs.models import CvDraft, CvImportJob, UserCv
from apps.cvs.services.completeness import (
    COMPLETION_THRESHOLD,
    application_readiness_issues,
    cv_completion_score,
    is_unsaved_builder_baseline,
)
from apps.cvs.services.thumbnails import current_thumbnail_ready
from apps.jobs.models import Job

from .lookups import (
    THEME_COLOR_PATTERN,
    active_specialization,
    normalize_theme_color,
    template_by_public_id,
)


class CvSerializer(serializers.ModelSerializer):
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
    application_ready = serializers.SerializerMethodField()
    has_saved_version = serializers.SerializerMethodField()

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
            'recruiter_searchable',
            'position_public_id',
            'position_level',
            'experience_years',
            'education_level',
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
            'application_ready',
            'has_saved_version',
            'import_job',
            'thumbnail_url',
            'thumbnail_status',
        ]
        read_only_fields = fields

    def get_has_unsaved_changes(self, obj) -> bool:
        try:
            draft = obj.draft
        except CvDraft.DoesNotExist:
            return False
        return (
            draft.base_version_id is None or draft.document_hash != draft.base_version.content_hash
        )

    def get_draft_updated_at(self, obj) -> datetime | None:
        try:
            return obj.draft.updated_at
        except CvDraft.DoesNotExist:
            return None

    def get_completion_score(self, obj) -> int:
        return cv_completion_score(obj)

    def get_is_complete(self, obj) -> bool:
        return cv_completion_score(obj) >= COMPLETION_THRESHOLD

    def get_application_ready(self, obj) -> bool:
        return not application_readiness_issues(obj, obj.latest_version)

    def get_has_saved_version(self, obj) -> bool:
        return obj.latest_version_id is not None and not is_unsaved_builder_baseline(
            obj, obj.latest_version
        )

    def get_import_job(self, obj) -> dict | None:
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

    def get_thumbnail_url(self, obj) -> str | None:
        if not current_thumbnail_ready(obj):
            return None
        path = reverse('cv-thumbnail', kwargs={'public_id': obj.public_id})
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path

    def get_thumbnail_status(self, obj) -> str:
        return 'ready' if current_thumbnail_ready(obj) else 'pending'


class CvMetadataUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False, trim_whitespace=True)
    is_default = serializers.BooleanField(required=False)
    recruiter_searchable = serializers.BooleanField(required=False)
    # Hồ sơ ứng tuyển (CVT-3): vị trí mục tiêu và cấp bậc mong muốn, dùng cho matching.
    position_public_id = serializers.CharField(max_length=50, required=False, allow_null=True)
    position_level = serializers.ChoiceField(
        choices=Job.PositionLevel.choices, required=False, allow_blank=True
    )

    def validate_position_public_id(self, value):
        return None if value is None else active_specialization(value)

    def to_internal_value(self, data):
        attrs = super().to_internal_value(data)
        if 'position_public_id' in attrs:
            attrs['position'] = attrs.pop('position_public_id')
        return attrs

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('Provide at least one mutable field.')
        return attrs


class CvDuplicateSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255, required=False, allow_blank=False, trim_whitespace=True
    )


class CvCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    template_public_id = serializers.CharField(max_length=50)
    language = serializers.ChoiceField(choices=CvLanguage.choices, default=DEFAULT_CV_LANGUAGE)
    position_public_id = serializers.CharField(max_length=50, required=False, allow_blank=False)
    experience_band = serializers.ChoiceField(
        choices=ExperienceBand.choices, default=DEFAULT_EXPERIENCE_BAND
    )
    source_cv_public_id = serializers.CharField(max_length=50, required=False, allow_blank=False)
    theme_color = serializers.RegexField(THEME_COLOR_PATTERN, required=False)

    def validate_template_public_id(self, value):
        return template_by_public_id(value)

    def validate_position_public_id(self, value):
        return active_specialization(value)

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
        if attrs.get('position_public_id') and attrs.get('source_cv_public_id'):
            raise serializers.ValidationError(
                {'position_public_id': 'Use only one content source.'}
            )
        normalize_theme_color(attrs, attrs['template_public_id'])
        return attrs

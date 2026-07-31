"""Read-only contracts for administrators inspecting applications by job."""

from rest_framework import serializers

from ...models import Application


class AdminJobApplicationSerializer(serializers.ModelSerializer):
    candidate_public_id = serializers.CharField(source='candidate.public_id', read_only=True)
    candidate_name = serializers.SerializerMethodField()
    candidate_email = serializers.EmailField(source='candidate.email', read_only=True)
    candidate_account_status = serializers.CharField(source='candidate.status', read_only=True)
    candidate_account_restricted = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    source_label = serializers.CharField(source='get_source_display', read_only=True)
    submitted_cv_version_public_id = serializers.CharField(
        source='submitted_cv_version.public_id', read_only=True
    )
    preferred_locations = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            'public_id',
            'candidate_public_id',
            'candidate_name',
            'candidate_email',
            'candidate_account_status',
            'candidate_account_restricted',
            'contact_name',
            'contact_email',
            'contact_phone',
            'status',
            'status_label',
            'source',
            'source_label',
            'submitted_cv_title',
            'submitted_cv_source',
            'submitted_cv_version_public_id',
            'cover_letter',
            'preferred_locations',
            'allow_ai_analysis',
            'data_processing_consent',
            'applied_at',
            'submitted_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_candidate_name(self, obj):
        return obj.candidate.full_name or obj.contact_name or obj.candidate.email

    def get_candidate_account_restricted(self, obj):
        candidate = obj.candidate
        return bool(candidate.status != 'active' or not candidate.is_active or candidate.is_deleted)

    def get_preferred_locations(self, obj):
        return [
            {'code': location.code, 'name': location.name}
            for location in obj.preferred_locations.all()
        ]

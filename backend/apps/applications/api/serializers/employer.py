from rest_framework import serializers

from apps.accounts.services import is_account_accessible

from ...models import Application
from ...services import available_status_decisions


class ApplicationSerializer(serializers.ModelSerializer):
    """Read model of one application in the recruiter workspace."""

    job = serializers.CharField(source='job.public_id', read_only=True)
    cv = serializers.CharField(source='cv.public_id', read_only=True, default=None)
    job_title = serializers.CharField(source='job.title', read_only=True)
    candidate_name = serializers.CharField(source='candidate.full_name', read_only=True)
    candidate_email = serializers.EmailField(source='candidate.email', read_only=True)
    candidate_account_status = serializers.CharField(source='candidate.status', read_only=True)
    candidate_account_restricted = serializers.SerializerMethodField()
    cv_title = serializers.CharField(source='cv.title', read_only=True)
    submitted_cv_version = serializers.CharField(
        source='submitted_cv_version.public_id', read_only=True
    )
    available_decisions = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            'public_id',
            'job',
            'job_title',
            'candidate_name',
            'candidate_email',
            'candidate_account_status',
            'candidate_account_restricted',
            'cv',
            'cv_title',
            'submitted_cv_version',
            'submitted_cv_title',
            'submitted_cv_source',
            'submitted_at',
            'cover_letter',
            'source',
            'status',
            'available_decisions',
            'employer_note',
            'employer_rating',
            'candidate_note',
            'applied_at',
            'viewed_at',
            'shortlisted_at',
            'interviewed_at',
            'rejected_at',
            'accepted_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_candidate_account_restricted(self, obj):
        return not is_account_accessible(obj.candidate)

    def get_available_decisions(self, obj):
        return available_status_decisions(obj)


class ApplicationAssessmentSerializer(serializers.Serializer):
    employer_note = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    employer_rating = serializers.IntegerField(
        required=False, allow_null=True, min_value=1, max_value=5
    )


class ApplicationStatusDecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Application.DECISION_STATUSES)


class ApplicationDecisionResultSerializer(serializers.Serializer):
    application = ApplicationSerializer()
    candidate_notice_at = serializers.DateTimeField(allow_null=True)

from rest_framework import serializers

from apps.accounts.services import is_account_accessible

from ...models import Application, CandidateBlock
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
    candidate_blocked = serializers.BooleanField(read_only=True, default=False)
    in_talent_pool = serializers.BooleanField(read_only=True, default=False)
    mass_apply_signal = serializers.SerializerMethodField()
    submission_number = serializers.IntegerField(read_only=True, default=1)
    last_reminded_at = serializers.DateTimeField(read_only=True, default=None)

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
            'candidate_blocked',
            'in_talent_pool',
            'mass_apply_signal',
            'employer_note',
            'employer_rating',
            'candidate_note',
            'applied_at',
            'submission_number',
            'last_reminded_at',
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

    def get_mass_apply_signal(self, obj):
        """Suggest blocking a candidate who sprays applications across jobs."""
        jobs = getattr(obj, 'recent_jobs_applied', 0) or 0
        if jobs < CandidateBlock.MASS_APPLY_MIN_JOBS or getattr(obj, 'candidate_blocked', False):
            return None
        return {'jobs': jobs, 'window_days': CandidateBlock.MASS_APPLY_WINDOW_DAYS}


class PreviousSubmissionSerializer(serializers.ModelSerializer):
    """An earlier, replaced submission: what it was and how it ended, read-only."""

    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Application
        fields = [
            'public_id',
            'applied_at',
            'status',
            'status_label',
            'submitted_cv_title',
            'withdrawn_at',
            'rejected_at',
        ]
        read_only_fields = fields


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

from rest_framework import serializers

from apps.cvs.models import UserCv
from apps.jobs.models import Job

from ...models import Application


class ApplicationSerializer(serializers.ModelSerializer):
    job = serializers.SlugRelatedField(
        slug_field='public_id', queryset=Job.objects.filter(status=Job.Status.ACTIVE)
    )
    cv = serializers.SlugRelatedField(
        slug_field='public_id',
        queryset=UserCv.objects.filter(is_deleted=False),
        allow_null=True,
        required=False,
    )
    job_title = serializers.CharField(source='job.title', read_only=True)
    candidate_name = serializers.CharField(source='candidate.full_name', read_only=True)
    candidate_email = serializers.EmailField(source='candidate.email', read_only=True)
    cv_title = serializers.CharField(source='cv.title', read_only=True)
    submitted_cv_version = serializers.CharField(
        source='submitted_cv_version.public_id', read_only=True
    )

    class Meta:
        model = Application
        fields = [
            'public_id',
            'job',
            'job_title',
            'candidate_name',
            'candidate_email',
            'cv',
            'cv_title',
            'submitted_cv_version',
            'submitted_cv_title',
            'submitted_cv_source',
            'submitted_at',
            'cover_letter',
            'source',
            'status',
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
        read_only_fields = [
            'public_id',
            'source',
            'status',
            'employer_note',
            'submitted_cv_version',
            'submitted_cv_title',
            'submitted_cv_source',
            'submitted_at',
            'applied_at',
            'viewed_at',
            'shortlisted_at',
            'interviewed_at',
            'rejected_at',
            'accepted_at',
            'updated_at',
        ]

    def validate_cv(self, cv):
        request = self.context['request']
        if cv.user_id != request.user.id:
            raise serializers.ValidationError('You can only apply with your own CV.')
        return cv

    def validate_job(self, job):
        request = self.context['request']
        if (
            self.instance is None
            and Application.objects.filter(candidate=request.user, job=job).exists()
        ):
            raise serializers.ValidationError('You already applied to this job.')
        return job


class ApplicationStatusUpdateSerializer(serializers.ModelSerializer):
    employer_rating = serializers.IntegerField(
        required=False, allow_null=True, min_value=1, max_value=5
    )

    class Meta:
        model = Application
        fields = ['status', 'employer_note', 'employer_rating']

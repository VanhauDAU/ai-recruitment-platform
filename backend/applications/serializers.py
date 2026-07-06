from rest_framework import serializers

from cvs.models import UserCv
from jobs.models import Job

from .models import Application


class ApplicationSerializer(serializers.ModelSerializer):
    job = serializers.SlugRelatedField(slug_field='public_id', queryset=Job.objects.filter(status=Job.Status.ACTIVE))
    cv = serializers.SlugRelatedField(slug_field='public_id', queryset=UserCv.objects.filter(is_deleted=False))
    job_title = serializers.CharField(source='job.title', read_only=True)
    cv_title = serializers.CharField(source='cv.title', read_only=True)

    class Meta:
        model = Application
        fields = [
            'public_id', 'job', 'job_title', 'cv', 'cv_title', 'cover_letter',
            'source', 'status', 'employer_note', 'candidate_note',
            'applied_at', 'viewed_at', 'shortlisted_at', 'interviewed_at',
            'rejected_at', 'accepted_at', 'updated_at',
        ]
        read_only_fields = [
            'public_id', 'source', 'status', 'employer_note',
            'applied_at', 'viewed_at', 'shortlisted_at', 'interviewed_at',
            'rejected_at', 'accepted_at', 'updated_at',
        ]

    def validate_cv(self, cv):
        request = self.context['request']
        if cv.user_id != request.user.id:
            raise serializers.ValidationError('You can only apply with your own CV.')
        return cv

    def validate_job(self, job):
        request = self.context['request']
        if self.instance is None and Application.objects.filter(candidate=request.user, job=job).exists():
            raise serializers.ValidationError('You already applied to this job.')
        return job


class ApplicationStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ['status', 'employer_note']

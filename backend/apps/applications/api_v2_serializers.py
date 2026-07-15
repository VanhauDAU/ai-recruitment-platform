"""V2 application contracts for candidate submission and recruiter snapshot reads."""

from rest_framework import serializers

from apps.cvs.api_v2_serializers import CvVersionSerializer
from apps.cvs.models import CvVersion, UserCv
from apps.jobs.models import Job

from .models import Application


class RecruiterApplicationSnapshotSerializer(serializers.ModelSerializer):
    application_public_id = serializers.CharField(source='public_id', read_only=True)
    job_public_id = serializers.CharField(source='job.public_id', read_only=True)
    cv = CvVersionSerializer(source='submitted_cv_version', read_only=True)

    class Meta:
        model = Application
        fields = [
            'application_public_id', 'job_public_id', 'submitted_at',
            'submitted_cv_title', 'submitted_cv_source', 'cv',
        ]
        read_only_fields = fields


class CandidateApplicationV2CreateSerializer(serializers.Serializer):
    job_public_id = serializers.CharField(max_length=50)
    cv_public_id = serializers.CharField(max_length=50)
    version_public_id = serializers.CharField(max_length=50)
    cover_letter = serializers.CharField(required=False, allow_blank=True, max_length=10000)

    def validate(self, attrs):
        candidate = self.context['request'].user
        try:
            job = Job.objects.get(public_id=attrs['job_public_id'], status=Job.Status.ACTIVE)
        except Job.DoesNotExist as error:
            raise serializers.ValidationError({'job_public_id': 'This job is unavailable.'}) from error
        try:
            cv = UserCv.objects.get(
                public_id=attrs['cv_public_id'], user=candidate, is_deleted=False,
            )
        except UserCv.DoesNotExist as error:
            raise serializers.ValidationError({'cv_public_id': 'Select one of your active CVs.'}) from error
        try:
            version = CvVersion.objects.get(
                public_id=attrs['version_public_id'], cv=cv,
            )
        except CvVersion.DoesNotExist as error:
            raise serializers.ValidationError({'version_public_id': 'Select an immutable version of this CV.'}) from error
        if version.version_kind == CvVersion.VersionKind.APPLICATION_SNAPSHOT:
            raise serializers.ValidationError({'version_public_id': 'Application snapshots cannot be submitted again.'})
        if Application.objects.filter(candidate=candidate, job=job).exists():
            raise serializers.ValidationError({'job_public_id': 'You already applied to this job.'})
        attrs['job'] = job
        attrs['cv'] = cv
        attrs['version'] = version
        return attrs


class CandidateApplicationV2Serializer(serializers.ModelSerializer):
    job_public_id = serializers.CharField(source='job.public_id', read_only=True)
    job_title = serializers.CharField(source='job.title', read_only=True)
    cv_public_id = serializers.SerializerMethodField()
    submitted_cv_version_public_id = serializers.CharField(source='submitted_cv_version.public_id', read_only=True)

    def get_cv_public_id(self, obj):
        return obj.cv.public_id if obj.cv_id else None

    class Meta:
        model = Application
        fields = [
            'public_id', 'job_public_id', 'job_title', 'cv_public_id',
            'submitted_cv_version_public_id', 'submitted_cv_title',
            'submitted_cv_source', 'submitted_at', 'cover_letter', 'status',
            'applied_at', 'updated_at',
        ]
        read_only_fields = fields

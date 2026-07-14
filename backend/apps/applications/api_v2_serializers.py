"""Read-only recruiter contracts for V2 application CV snapshots."""

from rest_framework import serializers

from apps.cvs.api_v2_serializers import CvVersionSerializer

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

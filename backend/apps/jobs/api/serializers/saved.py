from rest_framework import serializers

from ...models import Job, SavedJob
from .jobs import PublicJobListSerializer


class SavedJobSerializer(serializers.ModelSerializer):
    job = serializers.SlugRelatedField(slug_field='public_id', queryset=Job.objects.all(), write_only=True)
    job_detail = PublicJobListSerializer(source='job', read_only=True)

    class Meta:
        model = SavedJob
        fields = ['job', 'job_detail', 'created_at']
        read_only_fields = ['created_at']
        validators = []

    def create(self, validated_data):
        saved_job, _ = SavedJob.objects.get_or_create(**validated_data)
        return saved_job

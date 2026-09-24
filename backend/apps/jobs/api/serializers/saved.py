from rest_framework import serializers

from apps.services.services import record_job_promotion_metrics

from ...models import Job, SavedJob
from ...selectors.listing import publicly_available_job_filter
from .jobs import PublicJobListSerializer


class SavedJobSerializer(serializers.ModelSerializer):
    job = serializers.SlugRelatedField(
        slug_field='public_id', queryset=Job.objects.none(), write_only=True
    )
    job_detail = PublicJobListSerializer(source='job', read_only=True)

    class Meta:
        model = SavedJob
        fields = ['job', 'job_detail', 'created_at']
        read_only_fields = ['created_at']
        validators = []

    def get_fields(self):
        fields = super().get_fields()
        # Rebuild the public-availability predicate for every request so a
        # candidate cannot save a draft/closed/expired job by guessing its ID.
        fields['job'].queryset = Job.objects.filter(publicly_available_job_filter())
        return fields

    def create(self, validated_data):
        saved_job, created = SavedJob.objects.get_or_create(**validated_data)
        if created:
            record_job_promotion_metrics(job_ids=[saved_job.job_id], event='save')
        return saved_job

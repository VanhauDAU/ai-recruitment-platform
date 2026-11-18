from rest_framework import serializers

from ...models import Job, SavedJob
from ...selectors import public_jobs_queryset
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
        fields['job'].queryset = public_jobs_queryset()
        return fields

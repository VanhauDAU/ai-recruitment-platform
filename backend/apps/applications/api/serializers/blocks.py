from rest_framework import serializers

from ...models import CandidateBlock


class CandidateBlockCreateSerializer(serializers.Serializer):
    application_public_id = serializers.CharField(max_length=50)
    reason = serializers.ChoiceField(choices=CandidateBlock.Reason.choices)
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    duration_days = serializers.ChoiceField(choices=[30, 90, 180], required=False, allow_null=True)
    reject_pending = serializers.BooleanField(required=False, default=False)


class CandidateBlockSerializer(serializers.ModelSerializer):
    candidate_name = serializers.SerializerMethodField()
    candidate_email = serializers.EmailField(source='candidate.email', read_only=True)
    reason_label = serializers.CharField(source='get_reason_display', read_only=True)
    source_job_title = serializers.CharField(
        source='source_application.job.title', read_only=True, default=''
    )

    class Meta:
        model = CandidateBlock
        fields = [
            'public_id',
            'candidate_name',
            'candidate_email',
            'reason',
            'reason_label',
            'note',
            'source_job_title',
            'expires_at',
            'created_at',
        ]
        read_only_fields = fields

    def get_candidate_name(self, obj) -> str:
        return obj.candidate.full_name or obj.candidate.email

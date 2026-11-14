from rest_framework import serializers

from ...models import TalentPoolEntry


class TalentPoolAddSerializer(serializers.Serializer):
    application_public_id = serializers.CharField(max_length=50)
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, max_length=5
    )


class TalentPoolUpdateSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=30), required=False, max_length=5
    )


class TalentPoolInviteSerializer(serializers.Serializer):
    job_public_id = serializers.CharField(max_length=50)


class TalentPoolEntrySerializer(serializers.ModelSerializer):
    candidate_name = serializers.SerializerMethodField()
    candidate_email = serializers.EmailField(source='candidate.email', read_only=True)
    source_application_public_id = serializers.CharField(
        source='source_application.public_id', read_only=True, default=None
    )
    source_job_public_id = serializers.CharField(
        source='source_application.job.public_id', read_only=True, default=None
    )
    source_job_title = serializers.CharField(
        source='source_application.job.title', read_only=True, default=''
    )

    class Meta:
        model = TalentPoolEntry
        fields = [
            'public_id',
            'candidate_name',
            'candidate_email',
            'source_application_public_id',
            'source_job_public_id',
            'source_job_title',
            'note',
            'tags',
            'created_at',
            'expires_at',
        ]
        read_only_fields = fields

    def get_candidate_name(self, obj) -> str:
        return obj.candidate.full_name or obj.candidate.email


class TalentSuggestionSerializer(serializers.Serializer):
    entry = TalentPoolEntrySerializer()
    score = serializers.IntegerField()
    reasons = serializers.ListField(child=serializers.CharField())
    already_invited = serializers.BooleanField(source='entry.already_invited')


class CandidateTalentPoolSerializer(serializers.ModelSerializer):
    """What the candidate sees: who keeps their profile and until when."""

    company_name = serializers.CharField(
        source='source_application.job.company.company_name', read_only=True, default=''
    )
    source_job_title = serializers.CharField(
        source='source_application.job.title', read_only=True, default=''
    )

    class Meta:
        model = TalentPoolEntry
        fields = ['public_id', 'company_name', 'source_job_title', 'created_at', 'expires_at']
        read_only_fields = fields

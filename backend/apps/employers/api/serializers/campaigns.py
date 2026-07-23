from rest_framework import serializers

from ...models import RecruitmentCampaign


class RecruitmentCampaignSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    job_count = serializers.IntegerField(read_only=True, default=0)
    application_count = serializers.IntegerField(read_only=True, default=0)
    accepted_count = serializers.IntegerField(read_only=True, default=0)
    unviewed_application_count = serializers.IntegerField(read_only=True, default=0)
    draft_job_count = serializers.IntegerField(read_only=True, default=0)
    pending_job_count = serializers.IntegerField(read_only=True, default=0)
    active_job_count = serializers.IntegerField(read_only=True, default=0)
    expired_job_count = serializers.IntegerField(read_only=True, default=0)
    closed_job_count = serializers.IntegerField(read_only=True, default=0)
    rejected_job_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = RecruitmentCampaign
        fields = [
            'public_id',
            'name',
            'status',
            'status_label',
            'job_count',
            'application_count',
            'accepted_count',
            'unviewed_application_count',
            'draft_job_count',
            'pending_job_count',
            'active_job_count',
            'expired_job_count',
            'closed_job_count',
            'rejected_job_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'public_id',
            'status_label',
            'status',
            'job_count',
            'application_count',
            'accepted_count',
            'unviewed_application_count',
            'draft_job_count',
            'pending_job_count',
            'active_job_count',
            'expired_job_count',
            'closed_job_count',
            'rejected_job_count',
            'created_at',
            'updated_at',
        ]

    def to_internal_value(self, data):
        unexpected_fields = set(data) - {'name'}
        if unexpected_fields:
            raise serializers.ValidationError(
                {
                    field: 'Trường này không thuộc thông tin chiến dịch.'
                    for field in unexpected_fields
                }
            )
        return super().to_internal_value(data)


class CampaignStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=RecruitmentCampaign.Status.choices)


class CampaignPerformanceQuerySerializer(serializers.Serializer):
    days = serializers.ChoiceField(choices=(7, 30, 90), default=7)

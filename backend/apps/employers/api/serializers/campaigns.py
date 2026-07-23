from rest_framework import serializers

from common.media_storage import media_url_from_value

from ...models import CampaignActivity, RecruitmentCampaign


class RecruitmentCampaignSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    last_activity = serializers.SerializerMethodField()
    candidate_previews = serializers.SerializerMethodField()
    job_count = serializers.IntegerField(read_only=True, default=0)
    candidate_count = serializers.IntegerField(read_only=True, default=0)
    application_submission_count = serializers.IntegerField(read_only=True, default=0)
    application_pair_count = serializers.IntegerField(read_only=True, default=0)
    application_count = serializers.IntegerField(read_only=True, default=0)
    accepted_count = serializers.IntegerField(read_only=True, default=0)
    unviewed_count = serializers.IntegerField(read_only=True, default=0)
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
            'last_activity',
            'candidate_previews',
            'job_count',
            'candidate_count',
            'application_submission_count',
            'application_pair_count',
            'application_count',
            'accepted_count',
            'unviewed_count',
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
            'status',
            'status_label',
            'last_activity',
            'job_count',
            'candidate_count',
            'application_submission_count',
            'application_pair_count',
            'application_count',
            'accepted_count',
            'unviewed_count',
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

    def get_last_activity(self, obj):
        occurred_at = getattr(obj, 'last_activity_at', None) or obj.updated_at
        event_type = getattr(obj, 'last_activity_type', None) or 'campaign_updated'
        label = dict(CampaignActivity.EventType.choices).get(
            event_type,
            'Cập nhật chiến dịch',
        )
        return {
            'event_type': event_type,
            'label': label,
            'occurred_at': occurred_at,
        }

    def get_candidate_previews(self, obj):
        return [
            {
                'public_id': preview['public_id'],
                'full_name': preview['full_name'],
                'avatar_url': media_url_from_value(
                    preview['avatar_url'],
                    request=self.context.get('request'),
                ),
            }
            for preview in getattr(obj, 'candidate_previews', [])
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
    confirmation_code = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )


class CampaignActivitySerializer(serializers.ModelSerializer):
    group_label = serializers.CharField(source='get_group_display', read_only=True)
    event_label = serializers.CharField(source='get_event_type_display', read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = CampaignActivity
        fields = [
            'id',
            'group',
            'group_label',
            'event_type',
            'event_label',
            'actor_name',
            'subject_public_id',
            'metadata',
            'occurred_at',
        ]

    def get_actor_name(self, obj):
        if obj.actor is None:
            return 'Hệ thống'
        return obj.actor.full_name or obj.actor.email


class CampaignPerformanceQuerySerializer(serializers.Serializer):
    days = serializers.ChoiceField(choices=(7, 30, 90), default=7)

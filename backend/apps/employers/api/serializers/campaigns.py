from rest_framework import serializers

from common.media_storage import media_url_from_value

from ...models import CampaignActivity, RecruitmentCampaign
from ...services import campaign_active_seconds


class RecruitmentCampaignSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    # Sum of the vacancies of the campaign's jobs; each job owns its position.
    headcount = serializers.IntegerField(read_only=True, default=0)
    active_days = serializers.SerializerMethodField()
    activate = serializers.BooleanField(write_only=True, required=False, default=False)
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
    active_job_count = serializers.IntegerField(read_only=True, default=0)
    expired_job_count = serializers.IntegerField(read_only=True, default=0)
    hidden_job_count = serializers.IntegerField(read_only=True, default=0)
    closed_job_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = RecruitmentCampaign
        fields = [
            'public_id',
            'name',
            'description',
            'headcount',
            'start_date',
            'target_date',
            'is_continuous',
            'budget_min',
            'budget_max',
            'budget_source',
            'status',
            'status_label',
            'first_activated_at',
            'ended_at',
            'ended_by',
            'active_days',
            'activate',
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
            'active_job_count',
            'expired_job_count',
            'hidden_job_count',
            'closed_job_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'public_id',
            'headcount',
            'status',
            'status_label',
            'first_activated_at',
            'ended_at',
            'ended_by',
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
            'active_job_count',
            'expired_job_count',
            'hidden_job_count',
            'closed_job_count',
            'created_at',
            'updated_at',
        ]

    def get_active_days(self, obj):
        if obj.first_activated_at is None:
            return None
        return round(campaign_active_seconds(obj) / 86400, 1)

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

    def validate(self, attrs):
        if self.instance is not None:
            attrs.pop('activate', None)

        def current(field):
            return attrs[field] if field in attrs else getattr(self.instance, field, None)

        start_date, target_date = current('start_date'), current('target_date')
        if start_date and target_date and target_date < start_date:
            raise serializers.ValidationError(
                {'target_date': 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.'}
            )
        budget_min, budget_max = current('budget_min'), current('budget_max')
        if budget_min is not None and budget_max is not None and budget_max < budget_min:
            raise serializers.ValidationError(
                {'budget_max': 'Ngân sách tối đa không được nhỏ hơn tối thiểu.'}
            )
        if current('is_continuous') and 'target_date' not in attrs and target_date:
            attrs['target_date'] = None
        return attrs


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
    subject_public_id = serializers.SerializerMethodField()
    metadata = serializers.SerializerMethodField()

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
        if obj.group == CampaignActivity.Group.APPLICATION and not self.context.get(
            'candidate_data_access', False
        ):
            return 'Người dùng'
        return obj.actor.full_name or obj.actor.email

    def get_subject_public_id(self, obj):
        if obj.group == CampaignActivity.Group.APPLICATION and not self.context.get(
            'candidate_data_access', False
        ):
            return ''
        return obj.subject_public_id

    def get_metadata(self, obj):
        metadata = dict(obj.metadata or {})
        if obj.group == CampaignActivity.Group.APPLICATION and not self.context.get(
            'candidate_data_access', False
        ):
            safe_fields = ('job_title', 'from_status', 'to_status')
            metadata = {field: metadata[field] for field in safe_fields if field in metadata}
        return metadata


class CampaignPerformanceQuerySerializer(serializers.Serializer):
    days = serializers.ChoiceField(choices=(7, 30, 90), default=7)
    job = serializers.CharField(max_length=50, required=False, allow_blank=False)

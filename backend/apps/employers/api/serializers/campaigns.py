from django.utils import timezone
from rest_framework import serializers

from apps.jobs.models import JobCategory

from ...models import RecruitmentCampaign, RecruitmentNeed


class RecruitmentCampaignSerializer(serializers.ModelSerializer):
    campaign_job = serializers.SerializerMethodField()
    position_category = serializers.PrimaryKeyRelatedField(
        queryset=JobCategory.objects.filter(
            status=JobCategory.Status.ACTIVE,
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        ),
        required=False,
        allow_null=True,
    )
    position_category_name = serializers.CharField(source='position_category.name', read_only=True)
    source_need = serializers.SlugRelatedField(
        slug_field='public_id',
        queryset=RecruitmentNeed.objects.all(),
        required=False,
        allow_null=True,
    )
    position_level_label = serializers.CharField(
        source='get_position_level_display', read_only=True
    )
    budget_source_label = serializers.CharField(source='get_budget_source_display', read_only=True)
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
            'description',
            'source_need',
            'position_category',
            'position_category_name',
            'position_level',
            'position_level_label',
            'headcount_target',
            'start_date',
            'target_date',
            'is_continuous',
            'budget_min',
            'budget_max',
            'budget_source',
            'budget_source_label',
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
            'campaign_job',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'public_id',
            'position_category_name',
            'position_level_label',
            'budget_source_label',
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
            'campaign_job',
            'created_at',
            'updated_at',
        ]

    def get_campaign_job(self, campaign):
        if hasattr(campaign, 'job_public_id'):
            job_public_id = campaign.job_public_id
            job_title = campaign.job_title
            job_status = campaign.job_status
            deadline = campaign.job_deadline
            application_count = campaign.job_application_count
            view_count = campaign.job_view_count
            rejected_reason = campaign.job_rejected_reason
        else:
            job = campaign.jobs.order_by('-created_at').first()
            if job is None:
                return None
            job_public_id = job.public_id
            job_title = job.title
            job_status = job.status
            deadline = job.deadline
            application_count = job.application_count
            view_count = job.view_count
            rejected_reason = job.rejected_reason
        if not job_public_id:
            return None
        is_expired = bool(
            job_status == 'active'
            and deadline is not None
            and deadline < timezone.localdate()
        )
        return {
            'public_id': job_public_id,
            'title': job_title,
            'status': job_status,
            'deadline': deadline,
            'application_count': application_count or 0,
            'view_count': view_count or 0,
            'is_expired': is_expired,
            'rejected_reason': rejected_reason or '',
        }

    def validate(self, attrs):
        current = self.instance
        is_continuous = attrs.get('is_continuous', current.is_continuous if current else False)
        target_date = attrs.get('target_date', current.target_date if current else None)
        if target_date and target_date < timezone.localdate():
            raise serializers.ValidationError(
                {'target_date': 'Hạn hoàn thành không được ở quá khứ.'}
            )
        if is_continuous:
            attrs['target_date'] = None
        budget_min = attrs.get('budget_min', current.budget_min if current else None)
        budget_max = attrs.get('budget_max', current.budget_max if current else None)
        if (budget_min is None) != (budget_max is None):
            raise serializers.ValidationError({'budget_max': 'Nhập đủ khoảng ngân sách từ và đến.'})
        if budget_min is not None and budget_min > budget_max:
            raise serializers.ValidationError(
                {'budget_max': 'Ngân sách tối đa phải lớn hơn hoặc bằng tối thiểu.'}
            )
        return attrs


class CampaignStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=RecruitmentCampaign.Status.choices)


class RecruitmentNeedSuggestionSerializer(serializers.ModelSerializer):
    position_category_name = serializers.CharField(source='position_category.name', read_only=True)

    class Meta:
        model = RecruitmentNeed
        fields = [
            'public_id',
            'position_category_name',
            'position_level',
            'headcount',
            'target_date',
        ]

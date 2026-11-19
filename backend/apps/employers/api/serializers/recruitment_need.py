from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.jobs.models import JobCategory
from common.vietnam_time import vietnam_today

from ...models import RecruitmentNeed

MIN_BUDGET = 1_000_000


class RecruitmentNeedSerializer(serializers.ModelSerializer):
    position_category = serializers.PrimaryKeyRelatedField(
        queryset=JobCategory.objects.filter(
            status=JobCategory.Status.ACTIVE,
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
    )
    position_category_name = serializers.CharField(source='position_category.name', read_only=True)
    position_level_label = serializers.CharField(
        source='get_position_level_display', read_only=True
    )
    budget_source_label = serializers.CharField(source='get_budget_source_display', read_only=True)
    consultation_topics = serializers.ListField(
        child=serializers.ChoiceField(choices=RecruitmentNeed.ConsultationTopic.choices),
        required=False,
        default=list,
        allow_empty=True,
    )

    class Meta:
        model = RecruitmentNeed
        fields = [
            'public_id',
            'position_category',
            'position_category_name',
            'position_level',
            'position_level_label',
            'target_date',
            'is_continuous',
            'headcount',
            'budget_min',
            'budget_max',
            'budget_source',
            'budget_source_label',
            'consultation_topics',
            'completed_at',
            'is_active',
        ]
        read_only_fields = ['public_id', 'completed_at']

    def validate_headcount(self, value):
        if value < 1 or value > 10_000:
            raise serializers.ValidationError(_('Số lượng cần tuyển phải từ 1 đến 10.000.'))
        return value

    def validate_consultation_topics(self, value):
        if len(value) > 1:
            raise serializers.ValidationError(_('Chỉ được chọn một nhu cầu tư vấn.'))
        return value

    def validate(self, attrs):
        current = self.instance
        is_continuous = attrs.get('is_continuous', current.is_continuous if current else False)
        target_date = attrs.get('target_date', current.target_date if current else None)
        if not is_continuous and target_date is None:
            raise serializers.ValidationError(
                {'target_date': _('Chọn thời gian cần tuyển xong hoặc chọn Tuyển liên tục.')}
            )
        if target_date and target_date < vietnam_today():
            raise serializers.ValidationError(
                {'target_date': _('Thời gian cần tuyển xong không được ở trong quá khứ.')}
            )
        if is_continuous:
            attrs['target_date'] = None

        budget_min = attrs.get('budget_min', current.budget_min if current else None)
        budget_max = attrs.get('budget_max', current.budget_max if current else None)
        if budget_min is not None and budget_min < MIN_BUDGET:
            raise serializers.ValidationError(
                {'budget_min': _('Ngân sách tối thiểu là 1.000.000đ.')}
            )
        if budget_max is not None and budget_max < MIN_BUDGET:
            raise serializers.ValidationError(
                {'budget_max': _('Ngân sách tối thiểu là 1.000.000đ.')}
            )
        if (budget_min is None) != (budget_max is None):
            raise serializers.ValidationError(
                {'budget_max': _('Nhập đủ khoảng ngân sách từ và đến.')}
            )
        if budget_min is not None and budget_min > budget_max:
            raise serializers.ValidationError(
                {'budget_max': _('Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu.')}
            )
        return attrs

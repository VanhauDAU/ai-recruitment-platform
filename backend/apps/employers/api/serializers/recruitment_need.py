from django.utils import timezone
from rest_framework import serializers

from apps.jobs.models import JobCategory

from ...models import RecruitmentNeed


class RecruitmentNeedSerializer(serializers.ModelSerializer):
    position_category = serializers.PrimaryKeyRelatedField(
        queryset=JobCategory.objects.filter(
            status=JobCategory.Status.ACTIVE,
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
    )
    position_category_name = serializers.CharField(source='position_category.name', read_only=True)
    position_level_label = serializers.CharField(source='get_position_level_display', read_only=True)
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
            'public_id', 'position_category', 'position_category_name',
            'position_level', 'position_level_label', 'target_date', 'is_continuous',
            'headcount', 'budget_min', 'budget_max', 'budget_source',
            'budget_source_label', 'consultation_topics', 'completed_at',
        ]
        read_only_fields = ['public_id', 'completed_at']

    def validate_headcount(self, value):
        if value < 1 or value > 10_000:
            raise serializers.ValidationError('Số lượng cần tuyển phải từ 1 đến 10.000.')
        return value

    def validate_consultation_topics(self, value):
        if len(value) > 1:
            raise serializers.ValidationError('Chỉ được chọn một nhu cầu tư vấn.')
        return value

    def validate(self, attrs):
        is_continuous = attrs.get('is_continuous', False)
        target_date = attrs.get('target_date')
        if not is_continuous and target_date is None:
            raise serializers.ValidationError({'target_date': 'Chọn thời gian cần tuyển xong hoặc chọn Tuyển liên tục.'})
        if target_date and target_date < timezone.localdate():
            raise serializers.ValidationError({'target_date': 'Thời gian cần tuyển xong không được ở trong quá khứ.'})
        if is_continuous:
            attrs['target_date'] = None

        budget_min = attrs.get('budget_min')
        budget_max = attrs.get('budget_max')
        if (budget_min is None) != (budget_max is None):
            raise serializers.ValidationError({'budget_max': 'Nhập đủ khoảng ngân sách từ và đến.'})
        if budget_min is not None and budget_min > budget_max:
            raise serializers.ValidationError({'budget_max': 'Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu.'})
        return attrs

    def create(self, validated_data):
        recruiter = self.context['recruiter']
        validated_data['completed_at'] = timezone.now()
        need, _ = RecruitmentNeed.objects.update_or_create(
            recruiter=recruiter,
            defaults=validated_data,
        )
        return need

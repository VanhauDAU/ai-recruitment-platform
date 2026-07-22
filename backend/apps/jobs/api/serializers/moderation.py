"""Admin-only job moderation contracts."""

from rest_framework import serializers

from ...models import Job


class AdminJobModerationSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    employer_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Job
        fields = [
            'public_id',
            'title',
            'company_name',
            'employer_name',
            'description',
            'deadline',
            'status',
            'status_label',
            'submitted_at',
            'approved_at',
            'rejected_reason',
            'application_count',
            'created_at',
        ]
        read_only_fields = fields

    def get_employer_name(self, obj):
        return obj.posted_by.full_name or obj.posted_by.email


class AdminJobReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    reason = serializers.CharField(required=False, allow_blank=True, max_length=3000)

    def validate(self, attrs):
        if attrs['action'] == 'reject' and not attrs.get('reason', '').strip():
            raise serializers.ValidationError(
                {'reason': 'Nhập lý do từ chối để nhà tuyển dụng có thể chỉnh sửa tin.'}
            )
        return attrs

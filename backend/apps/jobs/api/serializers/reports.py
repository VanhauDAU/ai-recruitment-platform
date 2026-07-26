"""Serializer cho luồng báo cáo tin tuyển dụng."""

from rest_framework import serializers

from ...models import JobReport


class JobReportCreateSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(choices=JobReport.Reason.choices)
    detail = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        if attrs.get('reason') == JobReport.Reason.OTHER and not attrs.get('detail', '').strip():
            raise serializers.ValidationError(
                {'detail': 'Vui lòng mô tả cụ thể khi chọn "Lý do khác".'}
            )
        return attrs


class AdminJobReportSerializer(serializers.ModelSerializer):
    job_public_id = serializers.CharField(source='job.public_id', read_only=True)
    job_title = serializers.CharField(source='job.title', read_only=True)
    company_name = serializers.CharField(source='job.company.company_name', read_only=True)
    reporter_email = serializers.EmailField(source='reporter.email', read_only=True, default='')
    resolved_by_email = serializers.EmailField(
        source='resolved_by.email', read_only=True, default=''
    )
    reason_label = serializers.CharField(source='get_reason_display', read_only=True)

    class Meta:
        model = JobReport
        fields = [
            'public_id',
            'job_public_id',
            'job_title',
            'company_name',
            'reporter_email',
            'reason',
            'reason_label',
            'detail',
            'status',
            'resolution_note',
            'resolved_at',
            'resolved_by_email',
            'created_at',
        ]
        read_only_fields = fields


class AdminJobReportResolveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[JobReport.Status.UPHELD, JobReport.Status.DISMISSED])
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)

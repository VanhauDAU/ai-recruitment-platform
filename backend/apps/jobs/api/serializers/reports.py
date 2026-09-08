"""Serializer cho luồng báo cáo tin tuyển dụng."""

from rest_framework import serializers

from ...models import JobReport, JobReportResolutionEvent
from ...selectors import ADMIN_JOB_REPORT_ORDERING_FIELDS


class JobReportCreateSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(choices=JobReport.Reason.choices)
    detail = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        if attrs.get('reason') == JobReport.Reason.OTHER and not attrs.get('detail', '').strip():
            raise serializers.ValidationError(
                {'detail': 'Vui lòng mô tả cụ thể khi chọn "Lý do khác".'}
            )
        return attrs


class JobReportCreatedSerializer(serializers.ModelSerializer):
    """Minimal candidate response; moderation evidence remains admin-only."""

    class Meta:
        model = JobReport
        fields = ['public_id', 'status', 'created_at']
        read_only_fields = fields


class JobReportResolutionEventSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source='actor.email', read_only=True, default='')

    class Meta:
        model = JobReportResolutionEvent
        fields = [
            'public_id',
            'from_status',
            'to_status',
            'note',
            'actor_email',
            'created_at',
        ]
        read_only_fields = fields


class AdminJobReportSerializer(serializers.ModelSerializer):
    job_public_id = serializers.CharField(source='job.public_id', read_only=True)
    job_slug = serializers.CharField(source='job.slug', read_only=True)
    brand_slug = serializers.SerializerMethodField()
    job_title = serializers.CharField(source='job.title', read_only=True)
    company_name = serializers.CharField(source='job.company.company_name', read_only=True)
    reporter_email = serializers.EmailField(source='reporter.email', read_only=True, default='')
    resolved_by_email = serializers.EmailField(
        source='resolved_by.email', read_only=True, default=''
    )
    reason_label = serializers.CharField(source='get_reason_display', read_only=True)
    resolution_history = JobReportResolutionEventSerializer(many=True, read_only=True)

    class Meta:
        model = JobReport
        fields = [
            'public_id',
            'job_public_id',
            'job_slug',
            'brand_slug',
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
            'resolution_history',
            'created_at',
        ]
        read_only_fields = fields

    def get_brand_slug(self, obj):
        return obj.job.company.slug if obj.job.company.has_brand_page else None


class AdminJobReportQuerySerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=JobReport.Status.choices,
        allow_blank=True,
        required=False,
    )
    reason = serializers.ChoiceField(
        choices=JobReport.Reason.choices,
        allow_blank=True,
        required=False,
    )
    q = serializers.CharField(
        allow_blank=True,
        max_length=200,
        required=False,
        trim_whitespace=True,
    )
    created_from = serializers.DateField(required=False)
    created_to = serializers.DateField(required=False)
    ordering = serializers.ChoiceField(
        choices=[
            value for field in ADMIN_JOB_REPORT_ORDERING_FIELDS for value in (field, f'-{field}')
        ],
        default='-created_at',
        required=False,
    )
    page = serializers.IntegerField(min_value=1, required=False)

    def validate(self, attrs):
        created_from = attrs.get('created_from')
        created_to = attrs.get('created_to')
        if created_from and created_to and created_from > created_to:
            raise serializers.ValidationError(
                {'created_to': 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'}
            )
        return attrs


class AdminJobReportResolveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[JobReport.Status.UPHELD, JobReport.Status.DISMISSED])
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        if attrs.get('status') == JobReport.Status.UPHELD and not attrs.get('note', '').strip():
            raise serializers.ValidationError({'note': 'Nhập căn cứ xác nhận vi phạm.'})
        return attrs


class AdminJobReportReverseSerializer(serializers.Serializer):
    note = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        max_length=1000,
    )

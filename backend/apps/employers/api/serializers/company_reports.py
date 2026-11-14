"""Serializers for reporting a company page and for the admin report queue."""

from rest_framework import serializers

from common.media_storage import media_url_from_value

from ...models import CompanyReport, CompanyReportResolutionEvent
from ...page_registry import SECTION_TITLES
from ...selectors import ADMIN_COMPANY_REPORT_ORDERING_FIELDS

RESOLUTION_NOTE_MAX_LENGTH = 1000


class CompanyReportCreateSerializer(serializers.Serializer):
    OTHER_DETAIL_MIN_LENGTH = 10

    reason = serializers.ChoiceField(choices=CompanyReport.Reason.choices)
    section_key = serializers.ChoiceField(
        choices=list(SECTION_TITLES),
        required=False,
        allow_blank=True,
    )
    detail = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        if (
            attrs['reason'] == CompanyReport.Reason.OTHER
            and len(attrs.get('detail', '')) < self.OTHER_DETAIL_MIN_LENGTH
        ):
            raise serializers.ValidationError(
                {'detail': 'Vui lòng mô tả cụ thể ít nhất 10 ký tự khi chọn "Lý do khác".'}
            )
        return attrs


class CompanyReportCreatedSerializer(serializers.ModelSerializer):
    """Minimal candidate response; moderation evidence remains admin-only."""

    class Meta:
        model = CompanyReport
        fields = ['public_id', 'status']
        read_only_fields = fields


class CompanyReportResolutionEventSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source='actor.email', read_only=True, default='')

    class Meta:
        model = CompanyReportResolutionEvent
        fields = [
            'public_id',
            'from_status',
            'to_status',
            'note',
            'actor_email',
            'created_at',
        ]
        read_only_fields = fields


class AdminCompanyReportSerializer(serializers.ModelSerializer):
    """The admin job-report row with the job keys replaced by ``company``."""

    company = serializers.SerializerMethodField()
    reporter_email = serializers.EmailField(source='reporter.email', read_only=True, default='')
    resolved_by_email = serializers.EmailField(
        source='resolved_by.email', read_only=True, default=''
    )
    reason_label = serializers.CharField(source='get_reason_display', read_only=True)
    section_title = serializers.SerializerMethodField()
    resolution_history = CompanyReportResolutionEventSerializer(many=True, read_only=True)

    class Meta:
        model = CompanyReport
        fields = [
            'public_id',
            'company',
            'reporter_email',
            'reason',
            'reason_label',
            'section_key',
            'section_title',
            'detail',
            'status',
            'resolution_note',
            'resolved_at',
            'resolved_by_email',
            'resolution_history',
            'created_at',
        ]
        read_only_fields = fields

    def get_company(self, obj):
        company = obj.company
        return {
            'public_id': company.public_id,
            'slug': company.slug,
            'display_name': company.display_name,
            'logo_url': media_url_from_value(company.logo_url, request=self.context.get('request')),
            'content_policy_hold': company.content_policy_hold,
        }

    def get_section_title(self, obj):
        return SECTION_TITLES.get(obj.section_key, '')


class AdminCompanyReportQuerySerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=CompanyReport.Status.choices,
        allow_blank=True,
        required=False,
    )
    reason = serializers.ChoiceField(
        choices=CompanyReport.Reason.choices,
        allow_blank=True,
        required=False,
    )
    company = serializers.CharField(allow_blank=True, max_length=50, required=False)
    q = serializers.CharField(allow_blank=True, max_length=200, required=False)
    ordering = serializers.ChoiceField(
        choices=[
            value
            for field in ADMIN_COMPANY_REPORT_ORDERING_FIELDS
            for value in (field, f'-{field}')
        ],
        allow_blank=True,
        required=False,
    )


class AdminCompanyReportResolveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[CompanyReport.Status.UPHELD, CompanyReport.Status.DISMISSED]
    )
    note = serializers.CharField(max_length=RESOLUTION_NOTE_MAX_LENGTH)
    apply_hold = serializers.BooleanField(default=False)


class AdminCompanyReportReverseSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=RESOLUTION_NOTE_MAX_LENGTH)

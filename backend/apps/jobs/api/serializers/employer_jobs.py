"""Employer job contracts: the job form, its detail read and the management table."""

from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.campaigns.models import RecruitmentCampaign
from common.storage.media import media_url_from_value

from ...models import Job
from ...models.querysets import JobState, job_visibility_issues
from ...selectors.employer import (
    employer_job_application_summary,
    employer_job_visibility_hold,
)
from ...services import job_deadline_error
from .jobs import JobSerializer
from .public_jobs import PublicJobListSerializer
from .supporting import JobApplicationContactSerializer, JobApplicationEmailSerializer


class EmployerJobVisibilityHoldSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=('moderation', 'account'))
    code = serializers.CharField()
    label = serializers.CharField()
    held_at = serializers.DateTimeField(allow_null=True)
    reason_code = serializers.CharField(allow_blank=True)
    reason_label = serializers.CharField(allow_blank=True)
    # Changes requested: the owner edits, then resubmits for review.
    editable = serializers.BooleanField()
    resubmitted_at = serializers.DateTimeField(allow_null=True)
    request_note = serializers.CharField(allow_blank=True)


class EmployerJobVisibilityIssueSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    action = serializers.CharField()


class EmployerJobVisibilityHoldMixin(serializers.Serializer):
    """Tell the owner when, and why, candidates cannot see one of their jobs.

    ``visibility_hold`` details an administrator or account hold, the only
    holds that also freeze editing; ``visibility_issues`` lists every reason.
    """

    effective_state = serializers.SerializerMethodField()
    visibility_issues = serializers.SerializerMethodField()
    visibility_hold = serializers.SerializerMethodField()

    @extend_schema_field(serializers.ChoiceField(choices=JobState.choices))
    def get_effective_state(self, obj):
        job_visibility_issues(obj)  # loads the state when the queryset did not
        return obj.effective_state

    @extend_schema_field(EmployerJobVisibilityIssueSerializer(many=True))
    def get_visibility_issues(self, obj):
        return EmployerJobVisibilityIssueSerializer(job_visibility_issues(obj), many=True).data

    @extend_schema_field(EmployerJobVisibilityHoldSerializer(allow_null=True))
    def get_visibility_hold(self, obj):
        hold = employer_job_visibility_hold(obj)
        return EmployerJobVisibilityHoldSerializer(hold).data if hold else None


class EmployerJobWriteSerializer(EmployerJobVisibilityHoldMixin, JobSerializer):
    """Create/update DTO for the employer job form; never used for public reads."""

    application_contact = JobApplicationContactSerializer(required=False, allow_null=True)
    campaign = serializers.SlugRelatedField(
        slug_field='public_id',
        queryset=RecruitmentCampaign.objects.all(),
        required=False,
        allow_null=True,
    )
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    ai_generation_public_id = serializers.CharField(
        write_only=True,
        required=False,
        max_length=50,
    )

    class Meta(JobSerializer.Meta):
        fields = JobSerializer.Meta.fields + [
            'application_contact',
            'campaign',
            'campaign_name',
            'is_expired',
            'effective_state',
            'visibility_issues',
            'visibility_hold',
            'ai_generation_public_id',
            'auto_reject_stale_applications',
            'auto_reject_after_days',
            'auto_rejection_email_body',
            'submitted_at',
            'approved_at',
        ]
        read_only_fields = JobSerializer.Meta.read_only_fields + [
            'submitted_at',
            'approved_at',
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is not None and attrs.get('ai_generation_public_id'):
            raise serializers.ValidationError(
                {'ai_generation_public_id': _('Chỉ liên kết kết quả AI khi tạo tin mới.')}
            )
        enabled = attrs.get(
            'auto_reject_stale_applications',
            getattr(self.instance, 'auto_reject_stale_applications', True),
        )
        email_body = attrs.get(
            'auto_rejection_email_body',
            getattr(
                self.instance,
                'auto_rejection_email_body',
                Job.DEFAULT_AUTO_REJECTION_EMAIL,
            ),
        )
        if enabled and not email_body.strip():
            raise serializers.ValidationError(
                {'auto_rejection_email_body': _('Nhập nội dung email thông báo cho ứng viên.')}
            )
        return attrs

    def validate_deadline(self, deadline):
        if deadline_error := job_deadline_error(deadline, required=False):
            raise serializers.ValidationError(deadline_error)
        return deadline

    def validate_campaign(self, campaign):
        if campaign is None:
            return campaign
        request = self.context.get('request')
        if request is None or campaign.owner.user_id != request.user.id:
            raise serializers.ValidationError(_('Chiến dịch không thuộc tài khoản này.'))
        if campaign.is_terminal:
            raise serializers.ValidationError(
                _('Không thể thêm tin tuyển dụng vào chiến dịch đã hủy hoặc hoàn tất.')
            )
        return campaign


class EmployerJobApplicationSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    unviewed = serializers.IntegerField()
    unanswered = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())


class EmployerJobDetailSerializer(EmployerJobWriteSerializer):
    """Employer form read DTO, including private application recipients.

    Also carries the aggregates of the job workspace header: the engagement
    funnel and the applications per recruiter status. Neither identifies a
    candidate, so they stay readable while candidate-data access is blocked.
    """

    impression_count = serializers.IntegerField(read_only=True)
    application_summary = serializers.SerializerMethodField()

    class Meta(EmployerJobWriteSerializer.Meta):
        fields = EmployerJobWriteSerializer.Meta.fields + [
            'impression_count',
            'application_summary',
        ]

    @extend_schema_field(EmployerJobApplicationSummarySerializer)
    def get_application_summary(self, obj):
        return employer_job_application_summary(obj)


class DraftJobApplicationContactSerializer(JobApplicationContactSerializer):
    recipient_name = serializers.CharField(required=False, allow_blank=True, default='')
    phone = serializers.CharField(required=False, allow_blank=True, default='')
    emails = JobApplicationEmailSerializer(many=True, required=False, default=list)

    def validate_emails(self, emails):
        if len(emails) > 5:
            raise serializers.ValidationError(_('Chỉ được nhập tối đa 5 email nhận hồ sơ.'))
        normalized = [item['email'].strip().lower() for item in emails]
        if len(normalized) != len(set(normalized)):
            raise serializers.ValidationError(_('Email nhận hồ sơ không được trùng nhau.'))
        return emails


class EmployerJobDraftSerializer(EmployerJobWriteSerializer):
    """Partial draft contract; final validation happens only at publication time."""

    allow_incomplete_salary = True
    application_contact = DraftJobApplicationContactSerializer(required=False, allow_null=True)

    class Meta(EmployerJobWriteSerializer.Meta):
        extra_kwargs = {
            'title': {'required': False, 'allow_blank': True},
            'description': {'required': False, 'allow_blank': True},
        }


class EmployerJobListSerializer(EmployerJobVisibilityHoldMixin, PublicJobListSerializer):
    """Compact management-table DTO; rich job content stays on the detail API."""

    campaign = serializers.CharField(source='campaign.public_id', read_only=True, allow_null=True)
    campaign_name = serializers.CharField(source='campaign.name', read_only=True, allow_null=True)
    is_expired = serializers.BooleanField(read_only=True)
    candidate_count = serializers.IntegerField(read_only=True, default=0)
    unviewed_application_count = serializers.IntegerField(read_only=True, default=0)
    closes_on = serializers.DateField(read_only=True, allow_null=True, default=None)
    candidate_previews = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()

    class Meta(PublicJobListSerializer.Meta):
        fields = [
            'public_id',
            'slug',
            'title',
            'company_name',
            'locations_detail',
            'employment_type',
            'category_name',
            'salary_type',
            'salary_min',
            'salary_max',
            'income_display_type',
            'currency',
            'deadline',
            'closes_on',
            'requested_visibility_days',
            'first_approved_at',
            'visibility_starts_at',
            'visibility_ends_at',
            'is_visibility_expired',
            'status',
            'is_expired',
            'effective_state',
            'visibility_issues',
            'visibility_hold',
            'campaign',
            'campaign_name',
            'application_count',
            'candidate_count',
            'unviewed_application_count',
            'candidate_previews',
            'view_count',
            'published_at',
            'submitted_at',
            'approved_at',
            'created_at',
            'updated_at',
        ]
        list_serializer_class = serializers.ListSerializer
        read_only_fields = fields

    def get_category_name(self, obj) -> str:
        assignment = self._primary_assignment(obj)
        return assignment.category.name if assignment else ''

    def get_candidate_previews(self, obj) -> list[dict]:
        return [
            {
                **preview,
                'avatar_url': media_url_from_value(
                    preview['avatar_url'],
                    request=self.context.get('request'),
                ),
            }
            for preview in getattr(obj, 'candidate_previews', [])
        ]

"""Administrator job-management and moderation contracts."""

from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from ...models import Job, JobModerationEvent, JobStatusHistory
from ...services import create_job_review_token, job_moderation_state, job_pending_changes
from .reports import AdminJobReportSerializer
from .supporting import (
    JobApplicationContactSerializer,
    JobBenefitSerializer,
    JobCategoryAssignmentSerializer,
    JobLanguageRequirementSerializer,
    JobLocationSerializer,
    JobSkillSerializer,
    JobWorkScheduleSerializer,
)


class JobStatusHistoryAdminSerializer(serializers.ModelSerializer):
    changed_by_email = serializers.EmailField(source='changed_by.email', read_only=True, default='')
    actor_role_label = serializers.CharField(source='get_actor_role_display', read_only=True)

    class Meta:
        model = JobStatusHistory
        fields = [
            'id',
            'from_status',
            'to_status',
            'actor_role',
            'actor_role_label',
            'changed_by_email',
            'note',
            'created_at',
        ]
        read_only_fields = fields


class JobModerationEventSerializer(serializers.ModelSerializer):
    action_label = serializers.CharField(source='get_action_display', read_only=True)
    reason_label = serializers.CharField(source='get_reason_code_display', read_only=True)
    actor_email = serializers.EmailField(source='actor.email', read_only=True, default='')
    source_report_public_id = serializers.CharField(
        source='source_report.public_id', read_only=True, default=''
    )

    class Meta:
        model = JobModerationEvent
        fields = [
            'public_id',
            'action',
            'action_label',
            'reason_code',
            'reason_label',
            'note',
            'actor_email',
            'source_report_public_id',
            'from_status',
            'to_status',
            'from_hold',
            'to_hold',
            'content_fingerprint',
            'created_at',
        ]
        read_only_fields = fields


class AdminJobManagementListSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source='company.public_id', read_only=True)
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    employer_public_id = serializers.CharField(source='posted_by.public_id', read_only=True)
    employer_name = serializers.SerializerMethodField()
    employer_email = serializers.EmailField(source='posted_by.email', read_only=True)
    employer_account_status = serializers.CharField(source='posted_by.status', read_only=True)
    employer_email_verified = serializers.BooleanField(
        source='posted_by.email_verified', read_only=True
    )
    employer_phone_verified = serializers.SerializerMethodField()
    company_role = serializers.SerializerMethodField()
    company_role_label = serializers.SerializerMethodField()
    recruiter_profile_created_at = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    tier_label = serializers.CharField(source='get_tier_display', read_only=True)
    policy_hold_label = serializers.CharField(source='get_policy_hold_display', read_only=True)
    moderation_hold_label = serializers.CharField(
        source='get_moderation_hold_display', read_only=True
    )
    is_expired = serializers.SerializerMethodField()
    is_publicly_visible = serializers.BooleanField(read_only=True, default=False)
    pending_report_count = serializers.IntegerField(read_only=True, default=0)
    report_count = serializers.IntegerField(read_only=True, default=0)
    approved_job_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Job
        fields = [
            'public_id',
            'slug',
            'title',
            'company_public_id',
            'company_name',
            'employer_public_id',
            'employer_name',
            'employer_email',
            'employer_account_status',
            'employer_email_verified',
            'employer_phone_verified',
            'company_role',
            'company_role_label',
            'recruiter_profile_created_at',
            'status',
            'status_label',
            'is_expired',
            'is_publicly_visible',
            'policy_hold',
            'policy_hold_label',
            'moderation_hold',
            'moderation_hold_label',
            'tier',
            'tier_label',
            'is_hot',
            'is_urgent',
            'has_flash_badge',
            'deadline',
            'created_at',
            'submitted_at',
            'published_at',
            'approved_at',
            'updated_at',
            'view_count',
            'application_count',
            'pending_report_count',
            'report_count',
            'approved_job_count',
            'rejected_reason',
        ]
        read_only_fields = fields

    def _recruiter(self, obj):
        try:
            return obj.posted_by.recruiter_profile
        except ObjectDoesNotExist:
            return None

    def get_employer_name(self, obj):
        return obj.posted_by.full_name or obj.posted_by.email

    def get_employer_phone_verified(self, obj):
        recruiter = self._recruiter(obj)
        return bool(recruiter and recruiter.phone_verified_at)

    def get_company_role(self, obj):
        recruiter = self._recruiter(obj)
        return recruiter.company_role if recruiter else ''

    def get_company_role_label(self, obj):
        recruiter = self._recruiter(obj)
        return recruiter.get_company_role_display() if recruiter else ''

    def get_recruiter_profile_created_at(self, obj):
        recruiter = self._recruiter(obj)
        return recruiter.created_at if recruiter else None

    def get_is_expired(self, obj):
        return getattr(obj, 'is_expired_value', obj.is_expired)


class AdminJobModerationSerializer(AdminJobManagementListSerializer):
    """Compatibility name for the original list/review response."""

    description = serializers.CharField(read_only=True)

    class Meta(AdminJobManagementListSerializer.Meta):
        fields = [*AdminJobManagementListSerializer.Meta.fields, 'description']


class AdminJobDetailSerializer(AdminJobManagementListSerializer):
    category_assignments = JobCategoryAssignmentSerializer(many=True, read_only=True)
    job_locations = JobLocationSerializer(many=True, read_only=True)
    job_skills = JobSkillSerializer(many=True, read_only=True)
    work_schedules = JobWorkScheduleSerializer(many=True, read_only=True)
    job_benefits = JobBenefitSerializer(many=True, read_only=True)
    language_requirements = JobLanguageRequirementSerializer(many=True, read_only=True)
    application_contact = serializers.SerializerMethodField()
    can_view_sensitive_contact = serializers.SerializerMethodField()
    status_history = JobStatusHistoryAdminSerializer(many=True, read_only=True)
    moderation_events = JobModerationEventSerializer(many=True, read_only=True)
    reports = AdminJobReportSerializer(many=True, read_only=True)
    review_token = serializers.SerializerMethodField()
    state_actions = serializers.SerializerMethodField()
    blocked_reasons = serializers.SerializerMethodField()
    approve_blockers = serializers.SerializerMethodField()
    approve_requirements = serializers.SerializerMethodField()
    pending_changes = serializers.SerializerMethodField()
    employer_account_level = serializers.SerializerMethodField()
    employer_verification_completed = serializers.SerializerMethodField()

    class Meta(AdminJobManagementListSerializer.Meta):
        fields = [
            *AdminJobManagementListSerializer.Meta.fields,
            'description',
            'requirements',
            'benefits',
            'work_schedule_note',
            'work_type',
            'work_types',
            'employment_type',
            'education_level',
            'experience_years',
            'position_level',
            'gender_requirement',
            'age_min',
            'age_max',
            'number_of_vacancies',
            'salary_type',
            'salary_min',
            'salary_max',
            'income_display_type',
            'currency',
            'category_assignments',
            'job_locations',
            'job_skills',
            'work_schedules',
            'job_benefits',
            'language_requirements',
            'application_contact',
            'can_view_sensitive_contact',
            'status_history',
            'moderation_events',
            'reports',
            'review_token',
            'state_actions',
            'blocked_reasons',
            'approve_blockers',
            'approve_requirements',
            'pending_changes',
            'employer_account_level',
            'employer_verification_completed',
        ]

    def get_application_contact(self, obj):
        if not self.context.get('can_view_sensitive_contact'):
            return None
        try:
            contact = obj.application_contact
        except ObjectDoesNotExist:
            return None
        return JobApplicationContactSerializer(contact).data

    def get_can_view_sensitive_contact(self, obj):
        return bool(self.context.get('can_view_sensitive_contact'))

    def get_review_token(self, obj):
        return create_job_review_token(obj)

    def _state(self, obj):
        state = self.context.get('_moderation_state')
        if state is None:
            state = job_moderation_state(obj)
            self.context['_moderation_state'] = state
        return state

    def get_state_actions(self, obj):
        return self._state(obj)['state_actions']

    def get_blocked_reasons(self, obj):
        return self._state(obj)['blocked_reasons']

    def get_approve_blockers(self, obj):
        return self._state(obj)['approve_blockers']

    def get_approve_requirements(self, obj):
        return self._state(obj)['approve_requirements']

    def get_pending_changes(self, obj):
        return job_pending_changes(
            obj,
            include_sensitive=bool(self.context.get('can_view_sensitive_contact')),
        )

    def get_employer_account_level(self, obj):
        return self.context.get('employer_entitlement', {}).get('account_level', 0)

    def get_employer_verification_completed(self, obj):
        return self.context.get('employer_entitlement', {}).get('verification_completed', False)


class AdminJobReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    reason = serializers.CharField(required=False, allow_blank=True, max_length=3000)
    reason_code = serializers.ChoiceField(
        choices=JobModerationEvent.Reason.choices,
        required=False,
        allow_blank=True,
    )

    def validate(self, attrs):
        if attrs['action'] == 'reject' and not attrs.get('reason', '').strip():
            raise serializers.ValidationError(
                {'reason': 'Nhập lý do từ chối để nhà tuyển dụng có thể chỉnh sửa tin.'}
            )
        return attrs


class AdminJobDecisionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=JobModerationEvent.Action.choices)
    review_token = serializers.CharField(trim_whitespace=True)
    reason_code = serializers.ChoiceField(
        choices=JobModerationEvent.Reason.choices,
        required=False,
        allow_blank=True,
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=3000)
    deadline = serializers.DateField(required=False, allow_null=True)
    hold = serializers.ChoiceField(
        choices=[
            Job.ModerationHold.MANUAL_REVIEW,
            Job.ModerationHold.CONFIRMED_VIOLATION,
        ],
        required=False,
        default=Job.ModerationHold.MANUAL_REVIEW,
    )
    source_report_public_id = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        action = attrs['action']
        if action in {'reject', 'hide'} and not attrs.get('reason_code'):
            raise serializers.ValidationError({'reason_code': 'Chọn lý do xử lý.'})
        if action in {'reject', 'hide', 'restore'} and not attrs.get('note', '').strip():
            raise serializers.ValidationError({'note': 'Nhập ghi chú xử lý.'})
        return attrs

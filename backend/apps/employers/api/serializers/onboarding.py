from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ...models import DpaStatus, RecruiterProfile
from ...selectors import build_employer_onboarding_steps, build_employer_readiness
from ...services import (
    DpaPolicyUnavailable,
    current_dpa_policy,
    recruiter_badge_eligibility,
    recruiter_job_posting_entitlement,
    verification_checks,
)
from .companies import CompanySerializer


class EmployerReadinessBlockerSerializer(serializers.Serializer):
    code = serializers.CharField()
    capabilities = serializers.ListField(
        child=serializers.ChoiceField(
            choices=('job_workspace', 'verification', 'candidate_data', 'job_approval')
        )
    )
    message = serializers.CharField()
    action = serializers.CharField()


class EmployerDpaPolicySerializer(serializers.Serializer):
    available = serializers.BooleanField()
    policy_version = serializers.CharField(allow_blank=True)
    document_sha256 = serializers.CharField(allow_blank=True)
    document_url = serializers.URLField(allow_blank=True)


class EmployerDpaAcceptanceSerializer(serializers.Serializer):
    policy_version = serializers.CharField(max_length=64)
    document_sha256 = serializers.RegexField(r'^[0-9a-f]{64}$')


class EmployerBadgeCriterionSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    passed = serializers.BooleanField()
    action = serializers.CharField()


class EmployerBadgeEligibilitySerializer(serializers.Serializer):
    verified = serializers.BooleanField()
    criteria = EmployerBadgeCriterionSerializer(many=True)
    minimum_account_months = serializers.IntegerField(min_value=1, max_value=60)
    eligible_at = serializers.DateTimeField(allow_null=True)


class EmployerAccountVerificationSerializer(serializers.Serializer):
    level = serializers.IntegerField(min_value=0, max_value=3)
    account_level = serializers.IntegerField(min_value=0, max_value=3)
    admin_approved = serializers.BooleanField()
    dpa_current = serializers.BooleanField()
    verified_job_quota_eligible = serializers.BooleanField()


class RecruiterProfileSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    work_location = serializers.SerializerMethodField()
    onboarding = serializers.SerializerMethodField()
    verification_case = serializers.SerializerMethodField()
    job_workspace_ready = serializers.SerializerMethodField()
    verification_approved = serializers.SerializerMethodField()
    candidate_data_access = serializers.SerializerMethodField()
    dpa_status = serializers.SerializerMethodField()
    blockers = serializers.SerializerMethodField()
    dpa_policy = serializers.SerializerMethodField()
    badge_eligibility = serializers.SerializerMethodField()
    account_verification = serializers.SerializerMethodField()

    class Meta:
        model = RecruiterProfile
        fields = [
            'public_id',
            'company',
            'company_role',
            'position_title',
            'verified_phone',
            'gender',
            'contact_phone',
            'work_location',
            'registration_completed_at',
            'terms_accepted_at',
            'terms_policy_version',
            'marketing_opt_in',
            'marketing_decided_at',
            'phone_verified_at',
            'dpa_accepted_at',
            'dpa_grace_expires_at',
            'onboarding',
            'verification_case',
            'job_workspace_ready',
            'verification_approved',
            'candidate_data_access',
            'dpa_status',
            'dpa_policy',
            'blockers',
            'badge_eligibility',
            'account_verification',
            'created_at',
        ]
        read_only_fields = [f for f in fields if f != 'position_title']

    def get_work_location(self, obj):
        if obj.work_location_id is None:
            return None
        return {
            'id': obj.work_location_id,
            'name': obj.work_location.name,
            'level': obj.work_location.level,
        }

    def get_onboarding(self, obj):
        """Các mốc đăng ký, bảo mật và kích hoạt — luôn suy từ dữ liệu nguồn."""
        return self._onboarding(obj)

    def _onboarding(self, obj):
        cached = getattr(self, '_onboarding_cache', None)
        if cached is None:
            cached = self._onboarding_cache = {}
        if obj.pk not in cached:
            cached[obj.pk] = build_employer_onboarding_steps(
                obj,
                badge_eligibility=self._badge_eligibility(obj),
            )
        return cached[obj.pk]

    def _badge_eligibility(self, obj):
        cached = getattr(self, '_badge_eligibility_cache', None)
        if cached is None:
            cached = self._badge_eligibility_cache = {}
        if obj.pk not in cached:
            cached[obj.pk] = recruiter_badge_eligibility(obj)
        return cached[obj.pk]

    def _readiness(self, obj):
        cached = getattr(self, '_readiness_cache', None)
        if cached is None:
            cached = self._readiness_cache = {}
        if obj.pk not in cached:
            cached[obj.pk] = build_employer_readiness(
                obj,
                onboarding=self._onboarding(obj),
            )
        return cached[obj.pk]

    def get_job_workspace_ready(self, obj) -> bool:
        return self._readiness(obj)['job_workspace_ready']

    def get_verification_approved(self, obj) -> bool:
        return self._readiness(obj)['verification_approved']

    def get_candidate_data_access(self, obj) -> bool:
        return self._readiness(obj)['candidate_data_access']

    @extend_schema_field(
        serializers.ChoiceField(choices=[(status.value, status.value) for status in DpaStatus])
    )
    def get_dpa_status(self, obj) -> str:
        return self._readiness(obj)['dpa_status']

    @extend_schema_field(EmployerDpaPolicySerializer)
    def get_dpa_policy(self, obj) -> dict:
        try:
            return {'available': True, **current_dpa_policy()}
        except DpaPolicyUnavailable:
            return {
                'available': False,
                'policy_version': '',
                'document_sha256': '',
                'document_url': '',
            }

    @extend_schema_field(EmployerReadinessBlockerSerializer(many=True))
    def get_blockers(self, obj) -> list[dict]:
        return self._readiness(obj)['blockers']

    @extend_schema_field(EmployerBadgeEligibilitySerializer)
    def get_badge_eligibility(self, obj) -> dict:
        return self._badge_eligibility(obj)

    @extend_schema_field(EmployerAccountVerificationSerializer)
    def get_account_verification(self, obj) -> dict:
        _, entitlement = recruiter_job_posting_entitlement(obj.user)
        level = entitlement['account_level']
        return {
            'level': level,
            'account_level': level,
            'admin_approved': entitlement['admin_approved'],
            'dpa_current': entitlement.get('dpa_current', False),
            'verified_job_quota_eligible': entitlement['verified_job_quota_eligible'],
        }

    def get_verification_case(self, obj):
        case = getattr(obj, 'verification_case', None)
        if case is None:
            return {
                'public_id': None,
                'status': 'draft',
                'status_label': 'Chưa nộp',
                'decision_reason': '',
                'revision': 1,
                'submitted_at': None,
                'missing_steps': [],
                'final_rejection_count': 0,
                'rejection_limit': 3,
                'resubmission_locked': False,
                'resubmission_locked_at': None,
            }
        checks = verification_checks(case)
        return {
            'public_id': case.public_id,
            'status': case.status,
            'status_label': case.get_status_display(),
            'decision_reason': case.decision_reason,
            'revision': case.revision,
            'submitted_at': case.submitted_at,
            'final_rejection_count': case.final_rejection_count,
            'rejection_limit': 3,
            'resubmission_locked': case.resubmission_locked_at is not None,
            'resubmission_locked_at': case.resubmission_locked_at,
            'missing_steps': [
                key for key, complete in checks.items() if not complete and key != 'case_approved'
            ],
        }

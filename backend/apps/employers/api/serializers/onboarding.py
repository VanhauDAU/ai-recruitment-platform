from rest_framework import serializers

from ...models import RecruiterProfile
from ...selectors import build_employer_onboarding_steps
from ...services import verification_checks
from .companies import CompanySerializer


class RecruiterProfileSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    work_location = serializers.SerializerMethodField()
    onboarding = serializers.SerializerMethodField()
    verification_case = serializers.SerializerMethodField()

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
            'onboarding',
            'verification_case',
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
        return build_employer_onboarding_steps(obj)

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
            }
        checks = verification_checks(case)
        return {
            'public_id': case.public_id,
            'status': case.status,
            'status_label': case.get_status_display(),
            'decision_reason': case.decision_reason,
            'revision': case.revision,
            'submitted_at': case.submitted_at,
            'missing_steps': [
                key for key, complete in checks.items() if not complete and key != 'case_approved'
            ],
        }

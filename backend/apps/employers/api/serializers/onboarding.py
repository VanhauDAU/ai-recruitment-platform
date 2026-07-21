from rest_framework import serializers

from ...models import RecruiterProfile
from ...selectors import build_employer_onboarding_steps
from .companies import CompanySerializer


class RecruiterProfileSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    work_location = serializers.SerializerMethodField()
    onboarding = serializers.SerializerMethodField()

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

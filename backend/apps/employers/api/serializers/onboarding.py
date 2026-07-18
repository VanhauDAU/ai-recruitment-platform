from rest_framework import serializers

from ...models import CompanyDocument, RecruiterProfile
from .companies import CompanySerializer


class RecruiterProfileSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    work_location = serializers.SerializerMethodField()
    onboarding = serializers.SerializerMethodField()

    class Meta:
        model = RecruiterProfile
        fields = [
            'public_id', 'company', 'company_role', 'membership_status',
            'membership_review_note', 'position_title', 'verified_phone',
            'gender', 'contact_phone', 'work_location', 'registration_completed_at',
            'terms_accepted_at', 'terms_policy_version', 'marketing_opt_in',
            'marketing_decided_at', 'phone_verified_at', 'dpa_accepted_at',
            'onboarding', 'created_at',
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
        has_business_doc = bool(obj.company_id) and obj.company.documents.filter(
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
        ).exclude(status=CompanyDocument.Status.REJECTED).exists()
        steps = {
            'email_verified': obj.user.email_verified,
            'registration_completed': obj.registration_completed_at is not None,
            'consulting_need_completed': hasattr(obj, 'recruitment_need'),
            'phone_verified': obj.phone_verified_at is not None,
            'company_linked': obj.company_id is not None,
            'membership_approved': obj.membership_status == RecruiterProfile.MembershipStatus.APPROVED,
            'business_doc_submitted': has_business_doc,
            'dpa_accepted': obj.dpa_accepted_at is not None,
            'first_job_posted': obj.user.posted_jobs.exists(),
        }
        steps['account_ready'] = all([
            steps['email_verified'],
            steps['registration_completed'],
            steps['company_linked'],
            steps['membership_approved'],
            steps['consulting_need_completed'],
        ])
        steps['completed'] = all(steps.values())
        return steps

from rest_framework import serializers

from ...models import CompanyDocument, RecruiterProfile
from .companies import CompanySerializer


class RecruiterProfileSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    onboarding = serializers.SerializerMethodField()

    class Meta:
        model = RecruiterProfile
        fields = [
            'public_id', 'company', 'company_role', 'membership_status',
            'membership_review_note', 'position_title', 'verified_phone',
            'phone_verified_at', 'dpa_accepted_at', 'onboarding', 'created_at',
        ]
        read_only_fields = [f for f in fields if f != 'position_title']

    def get_onboarding(self, obj):
        """Trạng thái 5 bước onboarding — suy từ dữ liệu, xem RecruiterProfile docstring."""
        has_business_doc = bool(obj.company_id) and obj.company.documents.filter(
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
        ).exclude(status=CompanyDocument.Status.REJECTED).exists()
        steps = {
            'phone_verified': obj.phone_verified_at is not None,
            'company_linked': obj.company_id is not None,
            'membership_approved': obj.membership_status == RecruiterProfile.MembershipStatus.APPROVED,
            'business_doc_submitted': has_business_doc,
            'dpa_accepted': obj.dpa_accepted_at is not None,
            'first_job_posted': obj.user.posted_jobs.exists(),
        }
        steps['completed'] = all(steps.values())
        return steps

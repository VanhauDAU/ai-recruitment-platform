"""Request bodies of the admin verification actions (review, decide, revoke, unlock)."""

from rest_framework import serializers

from ....models import CompanyDocument, EmployerVerificationCase


class AdminVerificationDocumentReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(
        choices=[
            CompanyDocument.Status.APPROVED,
            CompanyDocument.Status.CHANGES_REQUESTED,
            CompanyDocument.Status.REJECTED,
        ]
    )
    reason = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    lock_version = serializers.IntegerField(min_value=0)
    revision_public_id = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if (
            attrs['decision'] != CompanyDocument.Status.APPROVED
            and not attrs.get('reason', '').strip()
        ):
            raise serializers.ValidationError(
                {'reason': 'Nhập lý do khi yêu cầu bổ sung hoặc từ chối.'}
            )
        return attrs


class AdminVerificationDecisionPreviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(
        choices=[
            EmployerVerificationCase.Status.APPROVED,
            EmployerVerificationCase.Status.CHANGES_REQUESTED,
            EmployerVerificationCase.Status.REJECTED,
        ]
    )
    reason = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    tax_override = serializers.BooleanField(required=False, default=False)
    tax_override_reason = serializers.CharField(
        max_length=2000,
        required=False,
        allow_blank=True,
    )

    def validate(self, attrs):
        if (
            attrs['decision'] != EmployerVerificationCase.Status.APPROVED
            and not attrs.get('reason', '').strip()
        ):
            raise serializers.ValidationError(
                {'reason': 'Nhập lý do khi yêu cầu bổ sung hoặc từ chối.'}
            )
        return attrs


class AdminVerificationDecisionConfirmationSerializer(AdminVerificationDecisionPreviewSerializer):
    impact_token = serializers.CharField()


class AdminVerificationLifecyclePreviewSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000)

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Nhập lý do thay đổi hiệu lực xác thực.')
        return value


class AdminVerificationLifecycleConfirmationSerializer(AdminVerificationLifecyclePreviewSerializer):
    impact_token = serializers.CharField()


class AdminVerificationResubmissionUnlockSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000)
    lock_version = serializers.IntegerField(min_value=0)

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Nhập lý do mở khóa nộp lại.')
        return value

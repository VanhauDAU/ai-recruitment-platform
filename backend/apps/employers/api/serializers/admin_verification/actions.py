"""Request bodies of the admin verification actions (review, decide, revoke, unlock)."""

from django.utils.translation import gettext as _
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
                {'reason': _('Nhập lý do khi yêu cầu bổ sung hoặc từ chối.')}
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

    # The preview runs as the dialog opens, before a reason is typed; the
    # reason is signed into the token and required again on confirm.
    require_reason = False

    def validate(self, attrs):
        if (
            self.require_reason
            and attrs['decision'] != EmployerVerificationCase.Status.APPROVED
            and not attrs.get('reason', '').strip()
        ):
            raise serializers.ValidationError(
                {'reason': _('Nhập lý do khi yêu cầu bổ sung hoặc từ chối.')}
            )
        return attrs


class AdminVerificationDecisionConfirmationSerializer(AdminVerificationDecisionPreviewSerializer):
    require_reason = True
    impact_token = serializers.CharField()


class AdminVerificationLifecyclePreviewSerializer(serializers.Serializer):
    # Preview may run before a reason is typed; the confirm requires it.
    reason = serializers.CharField(max_length=2000, allow_blank=True, required=False, default='')


class AdminVerificationLifecycleConfirmationSerializer(AdminVerificationLifecyclePreviewSerializer):
    reason = serializers.CharField(max_length=2000)
    impact_token = serializers.CharField()

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(_('Nhập lý do thay đổi hiệu lực xác thực.'))
        return value


class AdminVerificationResubmissionUnlockSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000)
    lock_version = serializers.IntegerField(min_value=0)

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(_('Nhập lý do mở khóa nộp lại.'))
        return value

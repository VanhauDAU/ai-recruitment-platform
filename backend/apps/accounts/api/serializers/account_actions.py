"""Request/response contracts of the impact-preview + confirm account actions."""

from rest_framework import serializers

from ...models import (
    User,
)

# Trạng thái admin chuyển tới được; PENDING chỉ do luồng lời mời đặt.
MANAGED_ACCOUNT_STATUSES = (User.Status.ACTIVE, User.Status.INACTIVE, User.Status.BANNED)


class AccountStatusImpactSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=MANAGED_ACCOUNT_STATUSES)
    reason = serializers.CharField(max_length=500, trim_whitespace=True)
    enforcement_evidence = serializers.CharField(
        min_length=20,
        max_length=500,
        trim_whitespace=True,
        allow_blank=True,
        required=False,
        default='',
    )
    violation_category = serializers.ChoiceField(
        choices=['security', 'fraud', 'policy', 'legal', 'other'],
        allow_blank=True,
        required=False,
        default='',
    )

    def validate(self, attrs):
        target = self.context.get('target')
        requires_enforcement = attrs['status'] == User.Status.BANNED or (
            target is not None and target.status == User.Status.BANNED
        )
        if requires_enforcement and len(attrs.get('enforcement_evidence', '').strip()) < 20:
            raise serializers.ValidationError(
                {
                    'enforcement_evidence': (
                        'Bằng chứng xử lý cần mô tả cụ thể và có ít nhất 20 ký tự.'
                    )
                }
            )
        if attrs['status'] == User.Status.BANNED and not attrs.get('violation_category'):
            raise serializers.ValidationError(
                {'violation_category': 'Chọn nhóm vi phạm khi cấm tài khoản.'}
            )
        return attrs


class AccountStatusChangeSerializer(AccountStatusImpactSerializer):
    impact_token = serializers.CharField(trim_whitespace=True)


class AccountResourceHoldImpactSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, trim_whitespace=True)
    enforcement_evidence = serializers.CharField(
        min_length=20,
        max_length=500,
        trim_whitespace=True,
    )


class AccountResourceHoldChangeSerializer(AccountResourceHoldImpactSerializer):
    impact_token = serializers.CharField(trim_whitespace=True)


class AccountStatusImpactResponseSerializer(serializers.Serializer):
    operation = serializers.CharField()
    target = serializers.DictField()
    before = serializers.DictField()
    after = serializers.DictField()
    transition_kind = serializers.CharField()
    active_session_count = serializers.IntegerField()
    sessions_will_be_revoked = serializers.BooleanField()
    effects = serializers.DictField()
    requires_manual_resource_review = serializers.BooleanField()
    restoration_policy = serializers.CharField()
    blocked_reasons = serializers.ListField(child=serializers.CharField())
    can_apply = serializers.BooleanField()
    impact_token = serializers.CharField()


class AccountResourceHoldImpactResponseSerializer(serializers.Serializer):
    operation = serializers.CharField()
    target = serializers.DictField()
    campaign_count = serializers.IntegerField()
    job_count = serializers.IntegerField()
    business_statuses_will_remain_unchanged = serializers.BooleanField()
    account_will_remain_inactive = serializers.BooleanField()
    can_apply = serializers.BooleanField()
    impact_token = serializers.CharField()


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, trim_whitespace=True)


class RevokeSessionsSerializer(ReasonSerializer):
    impact_token = serializers.CharField(trim_whitespace=True)


class EmployerCompanyUnlinkImpactSerializer(ReasonSerializer):
    pass


class EmployerCompanyUnlinkConfirmSerializer(EmployerCompanyUnlinkImpactSerializer):
    impact_token = serializers.CharField(trim_whitespace=True)


class EmployerCompanyUnlinkImpactResponseSerializer(serializers.Serializer):
    operation = serializers.CharField()
    target = serializers.DictField()
    counts = serializers.DictField(child=serializers.IntegerField(min_value=0))
    blockers = serializers.ListField(child=serializers.CharField())
    can_apply = serializers.BooleanField()
    impact_token = serializers.CharField(allow_blank=True)


class AccountRecoverySerializer(ReasonSerializer):
    verification_evidence = serializers.CharField(
        min_length=20,
        max_length=500,
        trim_whitespace=True,
        error_messages={
            'min_length': 'Bằng chứng xác minh cần có ít nhất 20 ký tự.',
            'max_length': 'Bằng chứng xác minh không được vượt quá 500 ký tự.',
        },
    )


class AccountEmailImpactSerializer(AccountRecoverySerializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        value = User.objects.normalize_email(value)
        user = self.context['target_user']
        if value == User.objects.normalize_email(user.email):
            raise serializers.ValidationError('Email mới trùng với email hiện tại.')
        if User.objects.email_claimed_for_role(
            value,
            user.role,
            exclude_user_id=user.pk,
        ):
            raise serializers.ValidationError('Email này đã thuộc một tài khoản cùng loại.')
        return value


class AccountEmailChangeSerializer(AccountEmailImpactSerializer):
    impact_token = serializers.CharField(trim_whitespace=True)

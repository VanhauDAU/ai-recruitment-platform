from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count
from django.utils import timezone
from rest_framework import serializers

from apps.employers.selectors import build_employer_initial_onboarding
from apps.employers.services import verification_checks
from common.storage.media import media_url_from_value

from ...models import (
    AdminAccessAuditLog,
    AdminInvitation,
    AuthSession,
    User,
)
from .admin_account_resources import AdminAccountProfileSerializer
from .auth import admin_access_payload, password_field


class ManagedAccountSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    active_session_count = serializers.IntegerField(read_only=True)
    last_activity_at = serializers.DateTimeField(
        source='last_session_seen_at',
        allow_null=True,
        read_only=True,
    )
    context = serializers.SerializerMethodField()
    admin_access = serializers.SerializerMethodField()
    invitation = serializers.SerializerMethodField()
    has_usable_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'public_id',
            'email',
            'full_name',
            'phone',
            'avatar_url',
            'role',
            'status',
            'email_verified',
            'has_usable_password',
            'active_session_count',
            'last_activity_at',
            'last_login',
            'date_joined',
            'updated_at',
            'context',
            'admin_access',
            'invitation',
        ]

    def get_has_usable_password(self, obj) -> bool:
        return obj.has_usable_password()

    def get_avatar_url(self, obj) -> str:
        return media_url_from_value(
            obj.avatar_url,
            request=self.context.get('request'),
        )

    def get_context(self, obj) -> dict:
        if obj.is_candidate:
            try:
                profile = obj.candidate_profile
            except ObjectDoesNotExist:
                return {'kind': 'candidate'}
            return {
                'kind': 'candidate',
                'headline': profile.headline,
                'current_position': profile.current_position,
                'job_search_status': profile.job_search_status,
            }
        if obj.is_employer:
            try:
                recruiter = obj.recruiter_profile
            except ObjectDoesNotExist:
                return {'kind': 'employer'}
            company = recruiter.company
            verification = getattr(recruiter, 'verification_case', None)
            checks = verification_checks(verification) if verification else {}
            initial_onboarding = build_employer_initial_onboarding(
                recruiter,
                has_recruitment_need=getattr(obj, '_has_recruitment_need', False),
            )
            tax_code = company.tax_code if company else ''
            return {
                'kind': 'employer',
                'position_title': recruiter.position_title,
                'company_role': recruiter.company_role,
                'company_role_label': recruiter.get_company_role_display(),
                'initial_onboarding': initial_onboarding,
                # Compatibility for admin clients that have not moved to the
                # explicit initial_onboarding object yet.
                'onboarding_completed': initial_onboarding['completed'],
                'phone_verified': recruiter.has_verified_phone,
                'verification': (
                    {
                        'public_id': verification.public_id,
                        'status': verification.status,
                        'status_label': verification.get_status_display(),
                        'submitted_at': verification.submitted_at,
                        'missing_step_count': len(
                            [
                                key
                                for key, complete in checks.items()
                                if not complete and key != 'case_approved'
                            ]
                        ),
                    }
                    if verification
                    else {
                        'public_id': None,
                        'status': 'draft',
                        'status_label': 'Chưa nộp',
                        'submitted_at': None,
                        'missing_step_count': 10,
                    }
                ),
                'company': (
                    {
                        'public_id': company.public_id,
                        'name': company.company_name,
                        'tax_code': (f'***{tax_code[-4:]}' if len(tax_code) > 4 else '****')
                        if tax_code
                        else '',
                    }
                    if company
                    else None
                ),
            }
        return {'kind': 'admin'}

    def get_admin_access(self, obj) -> dict | None:
        return admin_access_payload(obj)

    def get_invitation(self, obj) -> dict | None:
        invitations = getattr(obj, 'account_admin_invitations', [])
        invitation = invitations[0] if invitations else None
        if invitation is None:
            return None
        status = invitation.status
        if status == AdminInvitation.Status.PENDING and invitation.expires_at <= timezone.now():
            status = AdminInvitation.Status.EXPIRED
        return {
            'public_id': invitation.public_id,
            'status': status,
            'invited_by_email': invitation.invited_by.email,
            'expires_at': invitation.expires_at,
            'accepted_at': invitation.accepted_at,
        }


class ManagedAccountDetailSerializer(ManagedAccountSerializer):
    profile = serializers.SerializerMethodField()
    section_counts = serializers.SerializerMethodField()
    status_enforcement = serializers.SerializerMethodField()

    class Meta(ManagedAccountSerializer.Meta):
        fields = [
            *ManagedAccountSerializer.Meta.fields,
            'profile',
            'section_counts',
            'status_enforcement',
        ]

    def get_profile(self, obj) -> dict | None:
        payload = AdminAccountProfileSerializer(
            obj,
            context={
                'can_view_sensitive': self.context.get('can_view_sensitive', False),
            },
        ).data
        if obj.is_candidate:
            return payload.get('candidate')
        if obj.is_employer:
            return payload.get('employer')
        return payload.get('admin')

    def get_section_counts(self, obj) -> dict:
        counts = {
            'active_sessions': obj.active_session_count,
            'activity': AdminAccessAuditLog.objects.filter(target_public_id=obj.public_id).count(),
        }
        if obj.is_candidate:
            counts.update(
                cvs=obj.cvs.filter(is_deleted=False).count(),
                applications=obj.applications.count(),
                consents=(
                    obj.candidate_profile.consents.count()
                    if hasattr(obj, 'candidate_profile')
                    else 0
                ),
            )
        elif obj.is_employer:
            recruiter = getattr(obj, 'recruiter_profile', None)
            counts.update(
                recruitment_needs=(recruiter.recruitment_needs.count() if recruiter else 0),
                jobs=obj.posted_jobs.count(),
                campaigns=recruiter.campaigns.count() if recruiter else 0,
                verification_documents=(
                    recruiter.verification_case.documents.count()
                    if recruiter and hasattr(recruiter, 'verification_case')
                    else 0
                ),
            )
        return counts

    def get_status_enforcement(self, obj) -> dict:
        transition = obj.status_transitions.select_related('actor').first()
        payload = {
            'last_transition': (
                {
                    'public_id': transition.public_id,
                    'kind': transition.kind,
                    'before_status': transition.before_status,
                    'after_status': transition.after_status,
                    'reason': transition.reason,
                    'violation_category': transition.violation_category,
                    'effect_summary': transition.effect_summary,
                    'actor': (
                        {
                            'public_id': transition.actor.public_id,
                            'email': transition.actor.email,
                            'full_name': transition.actor.full_name,
                        }
                        if transition.actor
                        else None
                    ),
                    'created_at': transition.created_at,
                }
                if transition
                else None
            ),
            'requires_resource_review': False,
            'campaign_holds': [],
            'job_holds': [],
        }
        if not obj.is_employer:
            return payload
        recruiter = getattr(obj, 'recruiter_profile', None)
        campaign_holds = (
            list(
                recruiter.campaigns.exclude(policy_hold='')
                .values('policy_hold')
                .annotate(count=Count('id'))
                .order_by('policy_hold')
            )
            if recruiter
            else []
        )
        job_holds = list(
            obj.posted_jobs.exclude(policy_hold='')
            .values('policy_hold')
            .annotate(count=Count('id'))
            .order_by('policy_hold')
        )
        payload.update(
            campaign_holds=campaign_holds,
            job_holds=job_holds,
            requires_resource_review=any(
                row['policy_hold'] in {'ban_review', 'legacy_lock'}
                for row in [*campaign_holds, *job_holds]
            ),
        )
        return payload


class ManagedAccountUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, trim_whitespace=True)
    phone = serializers.CharField(max_length=20, trim_whitespace=True, allow_blank=True)

    def validate_full_name(self, value):
        if len(value) < 2:
            raise serializers.ValidationError('Họ tên cần ít nhất 2 ký tự.')
        return value


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


class ManagedSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuthSession
        fields = [
            'id',
            'portal',
            'auth_method',
            'device_label',
            'ip_address',
            'created_at',
            'last_seen_at',
            'expires_at',
            'revoked_at',
        ]


class AccountActivitySerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source='actor.email', default='', read_only=True)

    class Meta:
        model = AdminAccessAuditLog
        fields = [
            'public_id',
            'action',
            'source',
            'actor_email',
            'actor_identifier',
            'target_type',
            'target_public_id',
            'payload',
            'created_at',
        ]


class AdminInvitationSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    invited_by = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = AdminInvitation
        fields = [
            'public_id',
            'user',
            'invited_by',
            'status',
            'reason',
            'expires_at',
            'accepted_at',
            'revoked_at',
            'created_at',
            'updated_at',
        ]

    def get_user(self, obj) -> dict:
        return {
            'public_id': obj.user.public_id,
            'email': obj.user.email,
            'full_name': obj.user.full_name,
            'status': obj.user.status,
        }

    def get_invited_by(self, obj) -> dict:
        return {
            'public_id': obj.invited_by.public_id,
            'email': obj.invited_by.email,
            'full_name': obj.invited_by.full_name,
        }

    def get_status(self, obj) -> str:
        if obj.status == AdminInvitation.Status.PENDING and obj.expires_at <= timezone.now():
            return AdminInvitation.Status.EXPIRED
        return obj.status


class AdminInvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255, trim_whitespace=True)
    reason = serializers.CharField(max_length=500, trim_whitespace=True)

    def validate_full_name(self, value):
        if len(value) < 2:
            raise serializers.ValidationError('Họ tên cần ít nhất 2 ký tự.')
        return value


class AdminInvitationTokenSerializer(serializers.Serializer):
    token = serializers.CharField(trim_whitespace=True)


class AdminInvitationAcceptSerializer(AdminInvitationTokenSerializer):
    password = password_field()
    password_confirm = serializers.CharField(write_only=True, max_length=25)

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError({'password_confirm': 'Mật khẩu xác nhận không khớp.'})
        return attrs

from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from rest_framework import serializers

from apps.employers.services import verification_checks

from ...models import (
    AdminAccessAuditLog,
    AdminInvitation,
    AdminProvisioningScope,
    AdminRole,
    AuthSession,
    User,
)
from .admin_account_resources import AdminAccountProfileSerializer
from .auth import password_field


def role_payload(role):
    return {
        'public_id': role.public_id,
        'code': role.code,
        'name': role.name,
        'department': {
            'public_id': role.department.public_id,
            'code': role.department.code,
            'name': role.department.name,
        },
        'permission_codes': sorted(item.code for item in role.permissions.all() if item.is_active),
    }


class ManagedAccountSerializer(serializers.ModelSerializer):
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
    mfa_methods = serializers.SerializerMethodField()

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
            'two_factor_enabled',
            'mfa_methods',
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

    def get_has_usable_password(self, obj):
        return obj.has_usable_password()

    def get_mfa_methods(self, obj):
        return {
            'email': bool(obj.two_factor_email_enabled),
            'totp': bool(obj.two_factor_totp_secret),
            'backup_codes_remaining': len(obj.two_factor_backup_code_hashes or []),
        }

    def get_context(self, obj):
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
            tax_code = company.tax_code if company else ''
            return {
                'kind': 'employer',
                'position_title': recruiter.position_title,
                'company_role': recruiter.company_role,
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
                        'verification_status': company.verification_status,
                    }
                    if company
                    else None
                ),
            }
        return {'kind': 'admin'}

    def get_admin_access(self, obj):
        if not obj.is_admin_role:
            return None
        memberships = getattr(obj, 'active_admin_memberships', [])
        membership = memberships[0] if memberships else None
        return {
            'is_superuser': obj.is_superuser,
            'membership': (
                {
                    'public_id': membership.public_id,
                    'role': role_payload(membership.role),
                    'assigned_at': membership.assigned_at,
                    'assigned_by_email': (
                        membership.assigned_by.email if membership.assigned_by else None
                    ),
                }
                if membership
                else None
            ),
        }

    def get_invitation(self, obj):
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

    class Meta(ManagedAccountSerializer.Meta):
        fields = [
            *ManagedAccountSerializer.Meta.fields,
            'profile',
            'section_counts',
        ]

    def get_profile(self, obj):
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

    def get_section_counts(self, obj):
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


class ManagedAccountUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, trim_whitespace=True)
    phone = serializers.CharField(max_length=20, trim_whitespace=True, allow_blank=True)

    def validate_full_name(self, value):
        if len(value) < 2:
            raise serializers.ValidationError('Họ tên cần ít nhất 2 ký tự.')
        return value


class AccountStatusImpactSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[User.Status.ACTIVE, User.Status.INACTIVE, User.Status.BANNED]
    )
    reason = serializers.CharField(max_length=500, trim_whitespace=True)


class AccountStatusChangeSerializer(AccountStatusImpactSerializer):
    impact_token = serializers.CharField(trim_whitespace=True)


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, trim_whitespace=True)


class RevokeSessionsSerializer(ReasonSerializer):
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


class InvitationRoleSerializer(serializers.ModelSerializer):
    department = serializers.SerializerMethodField()
    permission_codes = serializers.SlugRelatedField(
        source='permissions',
        slug_field='code',
        many=True,
        read_only=True,
    )

    class Meta:
        model = AdminRole
        fields = ['public_id', 'code', 'name', 'rank', 'department', 'permission_codes']

    def get_department(self, obj):
        return {
            'public_id': obj.department.public_id,
            'code': obj.department.code,
            'name': obj.department.name,
        }


class AdminInvitationSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    target_role = InvitationRoleSerializer(read_only=True)
    invited_by = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = AdminInvitation
        fields = [
            'public_id',
            'user',
            'target_role',
            'invited_by',
            'status',
            'reason',
            'expires_at',
            'accepted_at',
            'revoked_at',
            'created_at',
            'updated_at',
        ]

    def get_user(self, obj):
        return {
            'public_id': obj.user.public_id,
            'email': obj.user.email,
            'full_name': obj.user.full_name,
            'status': obj.user.status,
        }

    def get_invited_by(self, obj):
        return {
            'public_id': obj.invited_by.public_id,
            'email': obj.invited_by.email,
            'full_name': obj.invited_by.full_name,
        }

    def get_status(self, obj):
        if obj.status == AdminInvitation.Status.PENDING and obj.expires_at <= timezone.now():
            return AdminInvitation.Status.EXPIRED
        return obj.status


class AdminInvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255, trim_whitespace=True)
    target_role_public_id = serializers.SlugRelatedField(
        source='target_role',
        slug_field='public_id',
        queryset=AdminRole.objects.all(),
    )
    reason = serializers.CharField(max_length=500, trim_whitespace=True)

    def validate_full_name(self, value):
        if len(value) < 2:
            raise serializers.ValidationError('Họ tên cần ít nhất 2 ký tự.')
        return value


class AdminInvitationUpdateSerializer(serializers.Serializer):
    target_role_public_id = serializers.SlugRelatedField(
        source='target_role',
        slug_field='public_id',
        queryset=AdminRole.objects.all(),
    )
    reason = serializers.CharField(max_length=500, trim_whitespace=True)


class AdminInvitationTokenSerializer(serializers.Serializer):
    token = serializers.CharField(trim_whitespace=True)


class AdminInvitationAcceptSerializer(AdminInvitationTokenSerializer):
    password = password_field()
    password_confirm = serializers.CharField(write_only=True, max_length=25)

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError({'password_confirm': 'Mật khẩu xác nhận không khớp.'})
        return attrs


class ProvisioningScopeSerializer(serializers.ModelSerializer):
    source_role = InvitationRoleSerializer(read_only=True)
    target_role = InvitationRoleSerializer(read_only=True)
    configured_by_email = serializers.EmailField(
        source='configured_by.email',
        allow_null=True,
        read_only=True,
    )
    pending_invitation_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = AdminProvisioningScope
        fields = [
            'public_id',
            'source_role',
            'target_role',
            'is_active',
            'configured_by_email',
            'pending_invitation_count',
            'created_at',
            'updated_at',
        ]


class ProvisioningScopeCreateSerializer(serializers.Serializer):
    source_role_public_id = serializers.SlugRelatedField(
        source='source_role',
        slug_field='public_id',
        queryset=AdminRole.objects.all(),
    )
    target_role_public_id = serializers.SlugRelatedField(
        source='target_role',
        slug_field='public_id',
        queryset=AdminRole.objects.all(),
    )


class ProvisioningScopeStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class ProvisioningScopeConfirmSerializer(ProvisioningScopeStatusSerializer):
    impact_token = serializers.CharField(trim_whitespace=True)

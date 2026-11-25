"""Administrator account list/detail contracts, sessions and activity timeline."""

from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Count
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.employers.selectors import build_employer_initial_onboarding
from apps.employers.services import verification_checks
from common.storage.media import media_url_from_value

from ...domain import account_activity as activity_rules
from ...models import (
    AdminInvitation,
    AuthSession,
    User,
)
from .admin_account_profile import AdminAccountProfileSerializer
from .auth import admin_access_payload


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
            next_action = {
                'code': getattr(obj, 'recruiter_next_action', None),
                'company_update_public_id': getattr(obj, 'pending_company_update_public_id', None),
            }
            try:
                recruiter = obj.recruiter_profile
            except ObjectDoesNotExist:
                return {'kind': 'employer', 'next_action': next_action}
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
                'phone_verified': recruiter.has_verified_phone,
                'next_action': next_action,
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
                        'status_label': _('Chưa nộp'),
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
        counts = {'active_sessions': obj.active_session_count}
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
            raise serializers.ValidationError(_('Họ tên cần ít nhất 2 ký tự.'))
        return value


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


class AccountActivityActorSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=['admin', 'self', 'member', 'system'])
    label = serializers.CharField()


class AccountActivityDetailSerializer(serializers.Serializer):
    label = serializers.CharField()
    value = serializers.CharField()
    type = serializers.ChoiceField(choices=['text', 'datetime'])


class AccountActivityEntrySerializer(serializers.Serializer):
    id = serializers.CharField()
    category = serializers.ChoiceField(choices=list(activity_rules.CATEGORIES))
    event = serializers.CharField()
    title = serializers.CharField()
    summary = serializers.CharField(allow_blank=True)
    tone = serializers.ChoiceField(choices=['neutral', 'success', 'warning', 'danger'])
    actor = AccountActivityActorSerializer()
    occurred_at = serializers.DateTimeField()
    details = AccountActivityDetailSerializer(many=True)


class AccountActivityCountsSerializer(serializers.Serializer):
    all = serializers.IntegerField()
    security = serializers.IntegerField()
    account = serializers.IntegerField()
    verification = serializers.IntegerField()
    company = serializers.IntegerField()
    recruitment = serializers.IntegerField()


class AccountActivityPageSerializer(serializers.Serializer):
    results = AccountActivityEntrySerializer(many=True)
    next_cursor = serializers.CharField(allow_null=True)
    category_counts = AccountActivityCountsSerializer(required=False)

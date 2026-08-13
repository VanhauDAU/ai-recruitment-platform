from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ...models import CompanyDomainClaim, CompanyDomainClaimEvent
from ...selectors import domain_claim_allowed_actions
from ...services import domain_claim_txt_name


class CompanyDomainClaimSerializer(serializers.ModelSerializer):
    txt_name = serializers.SerializerMethodField()
    txt_value = serializers.SerializerMethodField()
    allowed_actions = serializers.SerializerMethodField()

    class Meta:
        model = CompanyDomainClaim
        fields = [
            'public_id',
            'domain',
            'method',
            'status',
            'txt_name',
            'txt_value',
            'challenge_expires_at',
            'verified_at',
            'last_checked_at',
            'next_check_at',
            'grace_expires_at',
            'expires_at',
            'lock_version',
            'allowed_actions',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField())
    def get_txt_name(self, obj):
        return domain_claim_txt_name(obj.domain)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_txt_value(self, obj):
        return self.context.get('txt_value')

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_allowed_actions(self, obj):
        return domain_claim_allowed_actions(obj)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Plaintext is intentionally never persisted. It may leave the service
        # only in the immediate create/rotate response.
        if not self.context.get('txt_value'):
            data.pop('txt_value', None)
        return data


class CompanyDomainClaimRotateSerializer(serializers.Serializer):
    lock_version = serializers.IntegerField(min_value=0)


class CompanyDomainClaimManualRequestSerializer(serializers.Serializer):
    lock_version = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(max_length=2000, trim_whitespace=True)


class AdminCompanyDomainClaimSerializer(CompanyDomainClaimSerializer):
    company = serializers.CharField(source='company.public_id', read_only=True)
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    requested_by = serializers.CharField(source='requested_by.public_id', read_only=True)
    requested_by_email = serializers.EmailField(source='requested_by.email', read_only=True)
    requested_by_status = serializers.CharField(source='requested_by.status', read_only=True)
    requested_by_email_verified = serializers.BooleanField(
        source='requested_by.email_verified', read_only=True
    )
    requester_profile = serializers.SerializerMethodField()
    company_tax_code = serializers.CharField(
        source='company.tax_code', read_only=True, allow_null=True
    )
    company_email = serializers.EmailField(source='company.email', read_only=True)
    company_phone = serializers.CharField(source='company.phone', read_only=True)
    company_website_url = serializers.CharField(source='company.website_url', read_only=True)
    reviewer = serializers.CharField(source='reviewer.public_id', read_only=True, allow_null=True)
    reviewer_email = serializers.EmailField(
        source='reviewer.email', read_only=True, allow_null=True
    )

    class Meta(CompanyDomainClaimSerializer.Meta):
        fields = [
            *CompanyDomainClaimSerializer.Meta.fields,
            'company',
            'company_name',
            'company_tax_code',
            'company_email',
            'company_phone',
            'company_website_url',
            'requested_by',
            'requested_by_email',
            'requested_by_status',
            'requested_by_email_verified',
            'requester_profile',
            'manual_review_requested_at',
            'reviewer',
            'reviewer_email',
            'review_reason',
            'revision',
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.DictField())
    def get_requester_profile(self, obj):
        profile = getattr(obj.requested_by, 'recruiter_profile', None)
        verification_case = getattr(profile, 'verification_case', None) if profile else None
        return {
            'public_id': getattr(profile, 'public_id', None),
            'company_role': getattr(profile, 'company_role', ''),
            'phone_verified': bool(getattr(profile, 'phone_verified_at', None)),
            'legal_status': getattr(verification_case, 'status', ''),
            'legal_method': getattr(verification_case, 'verification_method', ''),
        }


class AdminCompanyDomainClaimEventSerializer(serializers.ModelSerializer):
    actor = serializers.CharField(source='actor.public_id', read_only=True, allow_null=True)
    actor_email = serializers.EmailField(source='actor.email', read_only=True, allow_null=True)

    class Meta:
        model = CompanyDomainClaimEvent
        fields = [
            'public_id',
            'event_type',
            'actor',
            'actor_email',
            'payload',
            'created_at',
        ]
        read_only_fields = fields


class AdminCompanyDomainClaimDetailSerializer(AdminCompanyDomainClaimSerializer):
    events = AdminCompanyDomainClaimEventSerializer(many=True, read_only=True)

    class Meta(AdminCompanyDomainClaimSerializer.Meta):
        fields = [*AdminCompanyDomainClaimSerializer.Meta.fields, 'events']
        read_only_fields = fields


class AdminCompanyDomainClaimSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    manual_pending = serializers.IntegerField()
    dns_pending = serializers.IntegerField()
    verified = serializers.IntegerField()
    grace = serializers.IntegerField()
    needs_attention = serializers.IntegerField()
    oldest_manual_pending_at = serializers.DateTimeField(allow_null=True)


class AdminDomainClaimImpactSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000, trim_whitespace=True)
    decision = serializers.ChoiceField(
        choices=['approve_manual', 'reject_manual'],
        required=False,
    )


class AdminDomainClaimConfirmationSerializer(AdminDomainClaimImpactSerializer):
    impact_token = serializers.CharField(trim_whitespace=True)


class AdminDomainClaimImpactResponseSerializer(serializers.Serializer):
    action = serializers.CharField()
    reason = serializers.CharField()
    status = serializers.CharField()
    domain = serializers.CharField()
    public_id = serializers.CharField()
    lock_version = serializers.IntegerField()
    impact_token = serializers.CharField()

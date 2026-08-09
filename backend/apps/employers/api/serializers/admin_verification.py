import re
import unicodedata

from drf_spectacular.helpers import lazy_serializer
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_field
from rest_framework import serializers

from common.media_storage import media_url_from_value

from ...models import (
    CompanyDocument,
    CompanyTaxLookupEvidence,
    CompanyUpdateRequest,
    EmployerVerificationCase,
    EmployerVerificationEvent,
)
from ...services import verification_checks


def _normalized_legal_text(value):
    value = unicodedata.normalize('NFKC', str(value or '')).upper()
    return ' '.join(re.sub(r'[^\w]+', ' ', value, flags=re.UNICODE).split())


def _masked_tax_code(value):
    value = str(value or '')
    return f'***{value[-4:]}' if len(value) > 4 else ('****' if value else '')


VERIFICATION_CHECK_FIELDS = (
    'email_verified',
    'registration_completed',
    'consulting_need_completed',
    'phone_verified',
    'company_linked',
    'representative_documents_submitted',
    'business_documents_approved',
    'candidate_dpa_submitted',
    'candidate_dpa_approved',
    'dpa_accepted',
    'case_approved',
)
DECISION_SNAPSHOT_FIELDS = (
    'case_public_id',
    'case_revision',
    'lock_version',
    'decision',
    'reason',
    'checks',
    'tax_advisory',
    'tax_override',
    'tax_override_reason',
    'company_impact',
    'capability_impact',
    'verification_hold_impact',
)
LIFECYCLE_SNAPSHOT_FIELDS = (
    'case_public_id',
    'case_revision',
    'lock_version',
    'action',
    'reason',
    'company_impact',
    'capability_impact',
    'resources',
)


def _allowlisted_mapping(value, fields):
    if not isinstance(value, dict):
        return {}
    return {key: value[key] for key in fields if key in value}


def _public_decision_snapshot(value):
    if not isinstance(value, dict):
        return {}
    if value.get('decision') in {
        EmployerVerificationCase.Status.APPROVED,
        EmployerVerificationCase.Status.CHANGES_REQUESTED,
        EmployerVerificationCase.Status.REJECTED,
    }:
        snapshot = _allowlisted_mapping(value, DECISION_SNAPSHOT_FIELDS)
        snapshot['checks'] = _allowlisted_mapping(
            snapshot.get('checks'),
            VERIFICATION_CHECK_FIELDS,
        )
        tax_advisory = _allowlisted_mapping(
            snapshot.get('tax_advisory'),
            (
                'status',
                'provider_status',
                'evidence_public_id',
                'comparison',
                'requires_override',
            ),
        )
        tax_advisory['comparison'] = _allowlisted_mapping(
            tax_advisory.get('comparison'),
            ('tax_code', 'company_name'),
        )
        snapshot['tax_advisory'] = tax_advisory
        snapshot['company_impact'] = _allowlisted_mapping(
            snapshot.get('company_impact'),
            (
                'company_public_id',
                'current_status',
                'will_mark_verified',
                'will_downgrade',
            ),
        )
        snapshot['capability_impact'] = _allowlisted_mapping(
            snapshot.get('capability_impact'),
            ('candidate_data_access', 'job_approval', 'job_workspace'),
        )
        snapshot['verification_hold_impact'] = _allowlisted_mapping(
            snapshot.get('verification_hold_impact'),
            ('hold_count', 'campaign_count', 'job_count', 'active_jobs_to_unhide'),
        )
        return snapshot
    if value.get('action') in {
        EmployerVerificationCase.Status.REVOKED,
        EmployerVerificationCase.Status.EXPIRED,
    }:
        snapshot = _allowlisted_mapping(value, LIFECYCLE_SNAPSHOT_FIELDS)
        snapshot['company_impact'] = _allowlisted_mapping(
            snapshot.get('company_impact'),
            ('company_public_id', 'current_status', 'will_downgrade'),
        )
        snapshot['capability_impact'] = _allowlisted_mapping(
            snapshot.get('capability_impact'),
            (
                'candidate_data_access',
                'job_approval',
                'job_workspace',
                'job_create_edit_submit',
            ),
        )
        snapshot['resources'] = _allowlisted_mapping(
            snapshot.get('resources'),
            ('campaign_count', 'job_count', 'active_jobs_hidden_from_public'),
        )
        return snapshot
    return {}


def _latest_revision_evidence(obj):
    return next(
        (
            evidence
            for evidence in obj.tax_lookup_evidences.all()
            if evidence.workflow_revision == obj.revision
        ),
        None,
    )


class AdminTaxLookupEvidenceSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    comparison = serializers.SerializerMethodField()

    class Meta:
        model = CompanyTaxLookupEvidence
        fields = [
            'public_id',
            'provider',
            'status',
            'status_label',
            'workflow_revision',
            'tax_code',
            'submitted_company_name',
            'returned_tax_code',
            'registered_name',
            'international_name',
            'short_name',
            'provider_code',
            'provider_description',
            'response_hash',
            'comparison',
            'started_at',
            'completed_at',
            'created_at',
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get('can_view_sensitive', False):
            data['tax_code'] = _masked_tax_code(data['tax_code'])
            data['returned_tax_code'] = _masked_tax_code(data['returned_tax_code'])
            data['response_hash'] = ''
        return data

    def get_comparison(self, obj):
        if obj.status != CompanyTaxLookupEvidence.Status.FOUND:
            return {
                'tax_code': 'unavailable',
                'company_name': 'unavailable',
            }
        return {
            'tax_code': ('match' if obj.tax_code == obj.returned_tax_code else 'mismatch'),
            'company_name': (
                'match'
                if _normalized_legal_text(obj.submitted_company_name)
                == _normalized_legal_text(obj.registered_name)
                else 'mismatch'
            ),
        }


class AdminVerificationDocumentSerializer(serializers.ModelSerializer):
    doc_type_label = serializers.CharField(source='get_doc_type_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    uploaded_by_email = serializers.EmailField(source='uploaded_by.email', read_only=True)
    reviewed_by_email = serializers.EmailField(source='reviewed_by.email', read_only=True)
    supersedes_public_id = serializers.CharField(
        source='supersedes.public_id',
        allow_null=True,
        read_only=True,
    )
    source_url = serializers.SerializerMethodField()
    duplicate_company_count = serializers.SerializerMethodField()

    class Meta:
        model = CompanyDocument
        fields = [
            'public_id',
            'doc_type',
            'doc_type_label',
            'version',
            'is_current',
            'file_name',
            'mime_type',
            'file_size',
            'sha256',
            'status',
            'status_label',
            'review_note',
            'uploaded_by_email',
            'reviewed_by_email',
            'reviewed_at',
            'created_at',
            'supersedes_public_id',
            'source_url',
            'duplicate_company_count',
        ]
        read_only_fields = fields

    def get_duplicate_company_count(self, obj):
        return getattr(obj, 'duplicate_company_count', 0)

    def get_source_url(self, obj):
        if not self.context.get('can_view_sensitive', False):
            return None
        if obj.file_url.startswith(('http://', 'https://')):
            return obj.file_url
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get('can_view_sensitive', False):
            data.update(
                {
                    'file_name': '',
                    'mime_type': '',
                    'file_size': 0,
                    'sha256': '',
                    'uploaded_by_email': '',
                    'source_url': None,
                }
            )
        return data


class AdminVerificationEventSerializer(serializers.ModelSerializer):
    event_type_label = serializers.CharField(source='get_event_type_display', read_only=True)
    actor_email = serializers.EmailField(source='actor.email', read_only=True)

    class Meta:
        model = EmployerVerificationEvent
        fields = [
            'public_id',
            'event_type',
            'event_type_label',
            'actor_email',
            'payload',
            'created_at',
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self.context.get('can_view_sensitive', False):
            payload = data.get('payload')
            if isinstance(payload, dict):
                data['payload'] = {
                    key: value
                    for key, value in payload.items()
                    if key not in {'document_file_name'}
                }
        return data


class AdminVerificationCaseListSerializer(serializers.ModelSerializer):
    current_document_count = serializers.IntegerField(read_only=True)
    pending_document_count = serializers.IntegerField(read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    verification_method_label = serializers.CharField(
        source='get_verification_method_display',
        read_only=True,
    )
    recruiter_public_id = serializers.CharField(source='recruiter.public_id', read_only=True)
    user_public_id = serializers.CharField(source='recruiter.user.public_id', read_only=True)
    email = serializers.EmailField(source='recruiter.user.email', read_only=True)
    full_name = serializers.CharField(source='recruiter.user.full_name', read_only=True)
    phone_verified = serializers.SerializerMethodField()
    company = serializers.SerializerMethodField()
    missing_steps = serializers.SerializerMethodField()

    class Meta:
        model = EmployerVerificationCase
        fields = [
            'public_id',
            'recruiter_public_id',
            'user_public_id',
            'email',
            'full_name',
            'company',
            'status',
            'status_label',
            'verification_method',
            'verification_method_label',
            'phone_verified',
            'missing_steps',
            'current_document_count',
            'pending_document_count',
            'revision',
            'lock_version',
            'submitted_at',
            'review_started_at',
            'decided_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_phone_verified(self, obj):
        return obj.recruiter.phone_verified_at is not None

    def get_company(self, obj):
        if obj.company_id is None:
            return None
        sensitive = self.context.get('can_view_sensitive', False)
        tax_code = obj.company.tax_code or ''
        if tax_code and not sensitive:
            tax_code = f'***{tax_code[-4:]}' if len(tax_code) > 4 else '****'
        return {
            'public_id': obj.company.public_id,
            'name': obj.company.company_name,
            'tax_code': tax_code,
            'verification_status': obj.company.verification_status,
            'verification_source': obj.company.verification_source,
            'duplicate_tax_code_company_count': getattr(
                obj,
                'duplicate_tax_code_company_count',
                0,
            ),
            'verified_duplicate_tax_code_company_count': getattr(
                obj,
                'verified_duplicate_tax_code_company_count',
                0,
            ),
        }

    def get_missing_steps(self, obj):
        checks = verification_checks(obj)
        return [key for key, value in checks.items() if not value and key != 'case_approved']


class AdminVerificationCaseDetailSerializer(AdminVerificationCaseListSerializer):
    checks = serializers.SerializerMethodField()
    recruiter = serializers.SerializerMethodField()
    decision_snapshot = serializers.SerializerMethodField()
    documents = AdminVerificationDocumentSerializer(many=True, read_only=True)
    events = AdminVerificationEventSerializer(many=True, read_only=True)
    reviewer_email = serializers.EmailField(source='reviewer.email', read_only=True)
    tax_lookup_evidence = serializers.SerializerMethodField()
    tax_override_by_email = serializers.EmailField(
        source='tax_override_by.email',
        read_only=True,
    )

    class Meta(AdminVerificationCaseListSerializer.Meta):
        fields = [
            *AdminVerificationCaseListSerializer.Meta.fields,
            'checks',
            'recruiter',
            'documents',
            'events',
            'reviewer_email',
            'decision_reason',
            'decision_source',
            'decision_snapshot',
            'tax_override_reason',
            'tax_override_by_email',
            'tax_lookup_evidence',
        ]

    def get_checks(self, obj):
        return verification_checks(obj)

    def get_recruiter(self, obj):
        recruiter = obj.recruiter
        return {
            'position_title': recruiter.position_title,
            'company_role': recruiter.company_role,
            'contact_phone': recruiter.contact_phone,
            'verified_phone': recruiter.verified_phone,
            'work_location': (
                {
                    'id': recruiter.work_location_id,
                    'name': recruiter.work_location.name,
                }
                if recruiter.work_location_id
                else None
            ),
            'registration_completed_at': recruiter.registration_completed_at,
            'dpa_accepted_at': recruiter.dpa_accepted_at,
        }

    def get_tax_lookup_evidence(self, obj):
        evidence = _latest_revision_evidence(obj)
        if evidence is None:
            return None
        return AdminTaxLookupEvidenceSerializer(evidence, context=self.context).data

    @extend_schema_field(
        PolymorphicProxySerializer(
            component_name='AdminVerificationStoredSnapshot',
            serializers=[
                lazy_serializer(
                    'apps.employers.api.serializers.admin_verification.'
                    'AdminVerificationStoredDecisionSnapshotSerializer'
                ),
                lazy_serializer(
                    'apps.employers.api.serializers.admin_verification.'
                    'AdminVerificationStoredLifecycleSnapshotSerializer'
                ),
            ],
            resource_type_field_name=None,
        )
    )
    def get_decision_snapshot(self, obj):
        return _public_decision_snapshot(obj.decision_snapshot)


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


class AdminVerificationDecisionSerializer(AdminVerificationDecisionPreviewSerializer):
    impact_token = serializers.CharField(required=False, allow_blank=True)


class AdminVerificationDecisionConfirmationSerializer(AdminVerificationDecisionPreviewSerializer):
    impact_token = serializers.CharField()


class AdminVerificationLifecyclePreviewSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000)

    def validate_reason(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Nhập lý do thay đổi hiệu lực xác thực.')
        return value


class AdminVerificationLifecycleSerializer(AdminVerificationLifecyclePreviewSerializer):
    impact_token = serializers.CharField(required=False, allow_blank=True)


class AdminVerificationLifecycleConfirmationSerializer(AdminVerificationLifecyclePreviewSerializer):
    impact_token = serializers.CharField()


class AdminVerificationChecksSerializer(serializers.Serializer):
    email_verified = serializers.BooleanField()
    registration_completed = serializers.BooleanField()
    consulting_need_completed = serializers.BooleanField()
    phone_verified = serializers.BooleanField()
    company_linked = serializers.BooleanField()
    representative_documents_submitted = serializers.BooleanField()
    business_documents_approved = serializers.BooleanField()
    candidate_dpa_submitted = serializers.BooleanField()
    candidate_dpa_approved = serializers.BooleanField()
    dpa_accepted = serializers.BooleanField()
    case_approved = serializers.BooleanField()


class AdminVerificationTaxComparisonSerializer(serializers.Serializer):
    tax_code = serializers.ChoiceField(
        choices=['match', 'mismatch', 'pending', 'unavailable', 'stale_input']
    )
    company_name = serializers.ChoiceField(
        choices=['match', 'mismatch', 'pending', 'unavailable', 'stale_input']
    )


class AdminVerificationTaxAdvisorySerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            'missing',
            'pending',
            'matched',
            'mismatch',
            'not_found',
            'unavailable',
            'invalid',
        ]
    )
    provider_status = serializers.ChoiceField(
        choices=CompanyTaxLookupEvidence.Status.choices,
        allow_null=True,
    )
    evidence_public_id = serializers.CharField(allow_null=True)
    comparison = AdminVerificationTaxComparisonSerializer()
    requires_override = serializers.BooleanField()


class AdminVerificationDecisionCompanyImpactSerializer(serializers.Serializer):
    company_public_id = serializers.CharField(allow_null=True)
    current_status = serializers.ChoiceField(
        choices=['unverified', 'pending', 'verified', 'rejected'],
        allow_null=True,
    )
    will_mark_verified = serializers.BooleanField()
    will_downgrade = serializers.BooleanField()


class AdminVerificationLifecycleCompanyImpactSerializer(serializers.Serializer):
    company_public_id = serializers.CharField(allow_null=True)
    current_status = serializers.ChoiceField(
        choices=['unverified', 'pending', 'verified', 'rejected'],
        allow_null=True,
    )
    will_downgrade = serializers.BooleanField()


class AdminVerificationDecisionCapabilityImpactSerializer(serializers.Serializer):
    candidate_data_access = serializers.ChoiceField(choices=['eligible_after_recompute', 'blocked'])
    job_approval = serializers.ChoiceField(choices=['eligible_after_recompute', 'blocked'])
    job_workspace = serializers.ChoiceField(choices=['unchanged'])


class AdminVerificationLifecycleCapabilityImpactSerializer(serializers.Serializer):
    candidate_data_access = serializers.ChoiceField(choices=['blocked'])
    job_approval = serializers.ChoiceField(choices=['blocked'])
    job_workspace = serializers.ChoiceField(choices=['unchanged'])
    job_create_edit_submit = serializers.ChoiceField(choices=['unchanged'])


class AdminVerificationHoldImpactSerializer(serializers.Serializer):
    hold_count = serializers.IntegerField(min_value=0)
    campaign_count = serializers.IntegerField(min_value=0)
    job_count = serializers.IntegerField(min_value=0)
    active_jobs_to_unhide = serializers.IntegerField(min_value=0)


class AdminVerificationLifecycleResourcesSerializer(serializers.Serializer):
    campaign_count = serializers.IntegerField(min_value=0)
    job_count = serializers.IntegerField(min_value=0)
    active_jobs_hidden_from_public = serializers.IntegerField(min_value=0)


class AdminVerificationDecisionImpactSerializer(serializers.Serializer):
    case_public_id = serializers.CharField()
    case_revision = serializers.IntegerField(min_value=1)
    lock_version = serializers.IntegerField(min_value=0)
    decision = serializers.ChoiceField(
        choices=[
            EmployerVerificationCase.Status.APPROVED,
            EmployerVerificationCase.Status.CHANGES_REQUESTED,
            EmployerVerificationCase.Status.REJECTED,
        ]
    )
    reason = serializers.CharField(allow_blank=True)
    checks = AdminVerificationChecksSerializer()
    tax_advisory = AdminVerificationTaxAdvisorySerializer()
    tax_override = serializers.BooleanField()
    tax_override_reason = serializers.CharField(allow_blank=True)
    company_impact = AdminVerificationDecisionCompanyImpactSerializer()
    capability_impact = AdminVerificationDecisionCapabilityImpactSerializer()
    verification_hold_impact = AdminVerificationHoldImpactSerializer()
    unlocks_employer_capabilities = serializers.BooleanField()
    impact_token = serializers.CharField()


class AdminVerificationLifecycleImpactSerializer(serializers.Serializer):
    case_public_id = serializers.CharField()
    case_revision = serializers.IntegerField(min_value=1)
    lock_version = serializers.IntegerField(min_value=0)
    action = serializers.ChoiceField(
        choices=[
            EmployerVerificationCase.Status.REVOKED,
            EmployerVerificationCase.Status.EXPIRED,
        ]
    )
    reason = serializers.CharField()
    company_impact = AdminVerificationLifecycleCompanyImpactSerializer()
    capability_impact = AdminVerificationLifecycleCapabilityImpactSerializer()
    resources = AdminVerificationLifecycleResourcesSerializer()
    impact_token = serializers.CharField()


class AdminVerificationStoredDecisionSnapshotSerializer(serializers.Serializer):
    case_public_id = serializers.CharField()
    case_revision = serializers.IntegerField(min_value=1)
    lock_version = serializers.IntegerField(min_value=0)
    decision = serializers.ChoiceField(
        choices=[
            EmployerVerificationCase.Status.APPROVED,
            EmployerVerificationCase.Status.CHANGES_REQUESTED,
            EmployerVerificationCase.Status.REJECTED,
        ]
    )
    reason = serializers.CharField(allow_blank=True)
    checks = AdminVerificationChecksSerializer()
    tax_advisory = AdminVerificationTaxAdvisorySerializer()
    tax_override = serializers.BooleanField()
    tax_override_reason = serializers.CharField(allow_blank=True)
    company_impact = AdminVerificationDecisionCompanyImpactSerializer()
    capability_impact = AdminVerificationDecisionCapabilityImpactSerializer()
    verification_hold_impact = AdminVerificationHoldImpactSerializer()


class AdminVerificationStoredLifecycleSnapshotSerializer(serializers.Serializer):
    case_public_id = serializers.CharField()
    case_revision = serializers.IntegerField(min_value=1)
    lock_version = serializers.IntegerField(min_value=0)
    action = serializers.ChoiceField(
        choices=[
            EmployerVerificationCase.Status.REVOKED,
            EmployerVerificationCase.Status.EXPIRED,
        ]
    )
    reason = serializers.CharField()
    company_impact = AdminVerificationLifecycleCompanyImpactSerializer()
    capability_impact = AdminVerificationLifecycleCapabilityImpactSerializer()
    resources = AdminVerificationLifecycleResourcesSerializer()


class AdminVerificationDecisionWorkflowErrorSerializer(serializers.Serializer):
    code = serializers.ChoiceField(
        choices=[
            'VERIFICATION_INVALID_TRANSITION',
            'VERIFICATION_REASON_REQUIRED',
            'VERIFICATION_REQUIREMENTS_INCOMPLETE',
            'TAX_LOOKUP_PENDING',
            'TAX_OVERRIDE_REQUIRED',
            'TAX_OVERRIDE_REASON_REQUIRED',
        ]
    )
    detail = serializers.CharField()
    current_status = serializers.CharField(required=False)
    allowed_statuses = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )
    missing_requirements = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )
    tax_status = serializers.CharField(required=False)


class AdminVerificationLifecycleWorkflowErrorSerializer(serializers.Serializer):
    code = serializers.ChoiceField(
        choices=[
            'VERIFICATION_INVALID_TRANSITION',
            'VERIFICATION_REASON_REQUIRED',
        ]
    )
    detail = serializers.CharField()
    current_status = serializers.CharField(required=False)
    allowed_statuses = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )


class AdminVerificationDecisionFieldErrorSerializer(serializers.Serializer):
    decision = serializers.ListField(child=serializers.CharField(), required=False)
    reason = serializers.ListField(child=serializers.CharField(), required=False)
    impact_token = serializers.ListField(child=serializers.CharField(), required=False)
    tax_override = serializers.ListField(child=serializers.CharField(), required=False)
    tax_override_reason = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )


class AdminVerificationLifecycleFieldErrorSerializer(serializers.Serializer):
    reason = serializers.ListField(child=serializers.CharField(), required=False)
    impact_token = serializers.ListField(child=serializers.CharField(), required=False)


class AdminVerificationPermissionErrorSerializer(serializers.Serializer):
    code = serializers.ChoiceField(choices=['admin_permission_denied'])
    message = serializers.CharField()


class AdminVerificationStaleErrorSerializer(serializers.Serializer):
    code = serializers.ChoiceField(choices=['admin_resource_changed'])
    message = serializers.CharField()


class AdminVerificationTaxConflictErrorSerializer(serializers.Serializer):
    code = serializers.ChoiceField(choices=['company_tax_code_conflict'])
    message = serializers.CharField()


class AdminCompanyUpdateRequestSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    proof_type_label = serializers.CharField(source='get_proof_type_display', read_only=True)
    requested_by_email = serializers.EmailField(source='requested_by.email', read_only=True)
    requested_by_public_id = serializers.CharField(
        source='requested_by.public_id',
        read_only=True,
    )
    reviewed_by_email = serializers.EmailField(source='reviewed_by.email', read_only=True)
    company = serializers.SerializerMethodField()
    current_values = serializers.SerializerMethodField()
    industry_labels = serializers.SerializerMethodField()
    media_previews = serializers.SerializerMethodField()
    documents = AdminVerificationDocumentSerializer(many=True, read_only=True)
    tax_lookup_evidence = serializers.SerializerMethodField()

    class Meta:
        model = CompanyUpdateRequest
        fields = [
            'public_id',
            'company',
            'requested_by_email',
            'requested_by_public_id',
            'changes',
            'current_values',
            'industry_labels',
            'media_previews',
            'is_sensitive',
            'reason',
            'proof_type',
            'proof_type_label',
            'status',
            'status_label',
            'reviewed_by_email',
            'reviewed_at',
            'review_note',
            'documents',
            'tax_lookup_evidence',
            'revision',
            'lock_version',
            'submitted_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_company(self, obj):
        tax_code = obj.company.tax_code or ''
        if tax_code and not self.context.get('can_view_sensitive', False):
            tax_code = f'***{tax_code[-4:]}' if len(tax_code) > 4 else '****'
        return {
            'public_id': obj.company.public_id,
            'name': obj.company.company_name,
            'tax_code': tax_code,
        }

    def get_current_values(self, obj):
        company = obj.company
        assignments = list(company.company_industries.all())
        primary_assignment = next((item for item in assignments if item.is_primary), None)
        values = {}
        for field in obj.changes or {}:
            if field == 'industries':
                values[field] = [item.industry_id for item in assignments]
            elif field == 'primary_industry':
                values[field] = primary_assignment.industry_id if primary_assignment else None
            elif field in {
                'logo_pending',
                'cover_pending',
                'gallery_pending',
                'gallery_additions',
                'gallery_deletions',
            }:
                values[field] = False if field.endswith('_pending') else []
            elif hasattr(company, field):
                values[field] = getattr(company, field)
        return values

    def get_industry_labels(self, obj):
        industry_ids = {item.industry_id for item in obj.company.company_industries.all()}
        industry_ids.update(obj.changes.get('industries') or [])
        if obj.changes.get('primary_industry'):
            industry_ids.add(obj.changes['primary_industry'])
        labels = self.context.get('industry_labels', {})
        return {
            str(industry_id): labels.get(industry_id, str(industry_id))
            for industry_id in industry_ids
        }

    def get_media_previews(self, obj):
        changes = obj.changes or {}
        request = self.context.get('request')
        previews = {
            field: media_url_from_value(changes[field], request=request)
            for field in ('logo_url', 'cover_image_url')
            if changes.get(field)
        }
        previews['gallery_additions'] = [
            media_url_from_value(value, request=request)
            for value in changes.get('gallery_additions', [])
            if value
        ]
        return previews

    def get_tax_lookup_evidence(self, obj):
        evidence = _latest_revision_evidence(obj)
        if evidence is None:
            return None
        return AdminTaxLookupEvidenceSerializer(evidence, context=self.context).data


class AdminCompanyUpdateReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(
        choices=[
            CompanyUpdateRequest.Status.APPROVED,
            CompanyUpdateRequest.Status.REJECTED,
        ]
    )
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    lock_version = serializers.IntegerField(min_value=0)

    def validate(self, attrs):
        if (
            attrs['decision'] == CompanyUpdateRequest.Status.REJECTED
            and not attrs.get('note', '').strip()
        ):
            raise serializers.ValidationError({'note': 'Nhập lý do khi từ chối yêu cầu.'})
        return attrs

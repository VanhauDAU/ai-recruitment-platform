"""Read models of a verification case for the admin queue and detail page.

The stored decision snapshot is re-filtered through allowlists so internal
keys written by the workflow never reach the browser.
"""

import re
import unicodedata

from drf_spectacular.helpers import lazy_serializer
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_field
from rest_framework import serializers

from ....models import (
    CompanyDocument,
    CompanyTaxLookupEvidence,
    EmployerVerificationCase,
    EmployerVerificationEvent,
)
from ....services import verification_checks


def _normalized_legal_text(value):
    value = unicodedata.normalize('NFKC', str(value or '')).upper()
    return ' '.join(re.sub(r'[^\w]+', ' ', value, flags=re.UNICODE).split())


VERIFICATION_CHECK_FIELDS = (
    'email_verified',
    'registration_completed',
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
    'capability_impact',
    'verification_hold_impact',
    'rejection_impact',
)
LIFECYCLE_SNAPSHOT_FIELDS = (
    'case_public_id',
    'case_revision',
    'lock_version',
    'action',
    'reason',
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
        snapshot['capability_impact'] = _allowlisted_mapping(
            snapshot.get('capability_impact'),
            ('candidate_data_access', 'job_approval', 'job_workspace'),
        )
        snapshot['verification_hold_impact'] = _allowlisted_mapping(
            snapshot.get('verification_hold_impact'),
            ('hold_count', 'campaign_count', 'job_count', 'active_jobs_to_unhide'),
        )
        snapshot['rejection_impact'] = _allowlisted_mapping(
            snapshot.get('rejection_impact'),
            ('current_count', 'next_count', 'limit', 'will_lock_resubmission'),
        )
        return snapshot
    if value.get('action') in {
        EmployerVerificationCase.Status.REVOKED,
        EmployerVerificationCase.Status.EXPIRED,
    }:
        snapshot = _allowlisted_mapping(value, LIFECYCLE_SNAPSHOT_FIELDS)
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


def latest_revision_tax_evidence(obj):
    """Newest tax lookup made for the record's current revision or an earlier one."""
    return next(
        (
            evidence
            for evidence in obj.tax_lookup_evidences.all()
            if evidence.workflow_revision <= obj.revision
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

    def get_duplicate_company_count(self, obj) -> int:
        return getattr(obj, 'duplicate_company_count', 0)

    def get_source_url(self, obj) -> str | None:
        if obj.file_url.startswith(('http://', 'https://')):
            return obj.file_url
        return None


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
    rejection_limit = serializers.SerializerMethodField()
    resubmission_locked = serializers.SerializerMethodField()

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
            'final_rejection_count',
            'rejection_limit',
            'resubmission_locked',
            'resubmission_locked_at',
            'submitted_at',
            'review_started_at',
            'decided_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_phone_verified(self, obj) -> bool:
        return obj.recruiter.has_verified_phone

    def get_rejection_limit(self, obj) -> int:
        return 3

    def get_resubmission_locked(self, obj) -> bool:
        return obj.resubmission_locked_at is not None

    def get_company(self, obj) -> dict | None:
        if obj.company_id is None:
            return None
        return {
            'public_id': obj.company.public_id,
            'name': obj.company.company_name,
            'tax_code': obj.company.tax_code or '',
            'duplicate_tax_code_company_count': getattr(
                obj,
                'duplicate_tax_code_company_count',
                0,
            ),
        }

    def get_missing_steps(self, obj) -> list[str]:
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

    def get_checks(self, obj) -> dict[str, bool]:
        return verification_checks(obj)

    def get_recruiter(self, obj) -> dict:
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

    def get_tax_lookup_evidence(self, obj) -> dict | None:
        evidence = latest_revision_tax_evidence(obj)
        if evidence is None:
            return None
        return AdminTaxLookupEvidenceSerializer(evidence, context=self.context).data

    @extend_schema_field(
        PolymorphicProxySerializer(
            component_name='AdminVerificationStoredSnapshot',
            serializers=[
                lazy_serializer(
                    'apps.employers.api.serializers.admin_verification.schema.'
                    'AdminVerificationStoredDecisionSnapshotSerializer'
                )(),
                lazy_serializer(
                    'apps.employers.api.serializers.admin_verification.schema.'
                    'AdminVerificationStoredLifecycleSnapshotSerializer'
                )(),
            ],
            resource_type_field_name=None,
        )
    )
    def get_decision_snapshot(self, obj):
        return _public_decision_snapshot(obj.decision_snapshot)

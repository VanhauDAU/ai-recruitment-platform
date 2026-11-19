"""OpenAPI-only shapes of the decision/lifecycle impact previews, stored snapshots and errors.

The services build these payloads as plain dicts; the serializers here only
document them, so they are never used to render or validate data.
"""

from rest_framework import serializers

from ....models import CompanyTaxLookupEvidence, EmployerVerificationCase


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


class AdminVerificationRejectionImpactSerializer(serializers.Serializer):
    current_count = serializers.IntegerField(min_value=0)
    next_count = serializers.IntegerField(min_value=0)
    limit = serializers.IntegerField(min_value=1)
    will_lock_resubmission = serializers.BooleanField()


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
    capability_impact = AdminVerificationDecisionCapabilityImpactSerializer()
    verification_hold_impact = AdminVerificationHoldImpactSerializer()
    rejection_impact = AdminVerificationRejectionImpactSerializer()
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
    capability_impact = AdminVerificationDecisionCapabilityImpactSerializer()
    verification_hold_impact = AdminVerificationHoldImpactSerializer()
    rejection_impact = AdminVerificationRejectionImpactSerializer()


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
            'VERIFICATION_RESUBMISSION_LOCKED',
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

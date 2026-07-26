from rest_framework import serializers

from ...models import (
    CompanyDocument,
    EmployerVerificationCase,
    EmployerVerificationEvent,
)
from ...services import verification_checks


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
            'duplicate_company_count',
        ]
        read_only_fields = fields

    def get_duplicate_company_count(self, obj):
        return getattr(obj, 'duplicate_company_count', 0)


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
        }

    def get_missing_steps(self, obj):
        checks = verification_checks(obj)
        return [key for key, value in checks.items() if not value and key != 'case_approved']


class AdminVerificationCaseDetailSerializer(AdminVerificationCaseListSerializer):
    checks = serializers.SerializerMethodField()
    recruiter = serializers.SerializerMethodField()
    documents = AdminVerificationDocumentSerializer(many=True, read_only=True)
    events = AdminVerificationEventSerializer(many=True, read_only=True)
    reviewer_email = serializers.EmailField(source='reviewer.email', read_only=True)

    class Meta(AdminVerificationCaseListSerializer.Meta):
        fields = [
            *AdminVerificationCaseListSerializer.Meta.fields,
            'checks',
            'recruiter',
            'documents',
            'events',
            'reviewer_email',
            'decision_reason',
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


class AdminVerificationDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(
        choices=[
            EmployerVerificationCase.Status.APPROVED,
            EmployerVerificationCase.Status.CHANGES_REQUESTED,
            EmployerVerificationCase.Status.REJECTED,
        ]
    )
    reason = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    impact_token = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if (
            attrs['decision'] != EmployerVerificationCase.Status.APPROVED
            and not attrs.get('reason', '').strip()
        ):
            raise serializers.ValidationError(
                {'reason': 'Nhập lý do khi yêu cầu bổ sung hoặc từ chối.'}
            )
        return attrs

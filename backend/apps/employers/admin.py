from django.contrib import admin

from .models import (
    Company,
    CompanyDocument,
    CompanyImage,
    CompanyIndustry,
    CompanyUpdateEvent,
    CompanyUpdateRequest,
    CompanyUpdateRevision,
    EmployerPhoneVerificationEvent,
    Industry,
    RecruiterProfile,
    RecruitmentNeed,
)


class WorkflowReadOnlyAdmin:
    """Keep audit-owned workflow rows observable but immutable in Django admin."""

    actions = None

    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class WorkflowReadOnlyInline:
    """Show related workflow data without exposing inline writes."""

    extra = 0
    can_delete = False

    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Industry)
class IndustryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}


class CompanyIndustryInline(WorkflowReadOnlyInline, admin.TabularInline):
    model = CompanyIndustry


class CompanyImageInline(WorkflowReadOnlyInline, admin.TabularInline):
    model = CompanyImage


@admin.register(Company)
class CompanyAdmin(WorkflowReadOnlyAdmin, admin.ModelAdmin):
    list_display = [
        'company_name',
        'tax_code',
        'business_type',
        'verification_status',
        'has_brand_page',
        'created_at',
    ]
    list_filter = ['verification_status', 'business_type', 'has_brand_page']
    search_fields = ['company_name', 'trade_name', 'tax_code', 'slug']
    inlines = [CompanyIndustryInline, CompanyImageInline]


@admin.register(CompanyDocument)
class CompanyDocumentAdmin(WorkflowReadOnlyAdmin, admin.ModelAdmin):
    list_display = ['company', 'recruiter', 'doc_type', 'uploaded_by', 'status', 'created_at']
    list_filter = ['doc_type', 'status']
    search_fields = ['company__company_name', 'recruiter__user__email', 'uploaded_by__email']


@admin.register(CompanyUpdateRequest)
class CompanyUpdateRequestAdmin(WorkflowReadOnlyAdmin, admin.ModelAdmin):
    list_display = ['company', 'requested_by', 'is_sensitive', 'status', 'created_at']
    list_filter = ['status', 'is_sensitive']
    search_fields = ['company__company_name', 'requested_by__email']


@admin.register(CompanyUpdateRevision)
class CompanyUpdateRevisionAdmin(WorkflowReadOnlyAdmin, admin.ModelAdmin):
    list_display = ['public_id', 'update_request', 'number', 'submitted_by', 'submitted_at']
    search_fields = ['public_id', 'update_request__public_id', 'submitted_by__email']


@admin.register(CompanyUpdateEvent)
class CompanyUpdateEventAdmin(WorkflowReadOnlyAdmin, admin.ModelAdmin):
    list_display = ['public_id', 'update_request', 'event_type', 'revision_number', 'created_at']
    list_filter = ['event_type']
    search_fields = ['public_id', 'update_request__public_id', 'actor__email']


@admin.register(RecruiterProfile)
class RecruiterProfileAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'company',
        'company_role',
        'contact_phone',
        'verified_phone',
        'registration_completed_at',
        'created_at',
    ]
    list_filter = ['company_role', 'gender', 'marketing_opt_in']
    search_fields = ['user__email', 'company__company_name', 'contact_phone', 'verified_phone']
    readonly_fields = [
        'company',
        'company_role',
        'verified_phone',
        'phone_verified_at',
        'registration_completed_at',
        'terms_accepted_at',
        'terms_policy_version',
        'marketing_decided_at',
        'created_at',
        'updated_at',
    ]

    def save_model(self, request, obj, form, change):
        """Fail closed if a forged admin form tries to bypass link workflow."""

        if change and obj.pk:
            persisted = RecruiterProfile.objects.only('company_id', 'company_role').get(pk=obj.pk)
            obj.company_id = persisted.company_id
            obj.company_role = persisted.company_role
        super().save_model(request, obj, form, change)


@admin.register(RecruitmentNeed)
class RecruitmentNeedAdmin(admin.ModelAdmin):
    list_display = [
        'recruiter',
        'position_category',
        'position_level',
        'headcount',
        'budget_source',
        'completed_at',
    ]
    list_filter = ['position_level', 'budget_source', 'is_continuous']
    search_fields = [
        'recruiter__user__email',
        'recruiter__company__company_name',
        'position_category__name',
    ]
    readonly_fields = ['public_id', 'completed_at', 'created_at', 'updated_at']


@admin.register(EmployerPhoneVerificationEvent)
class EmployerPhoneVerificationEventAdmin(admin.ModelAdmin):
    list_display = ['public_id', 'user', 'purpose', 'event_type', 'outcome', 'occurred_at']
    list_filter = ['purpose', 'event_type', 'outcome']
    search_fields = ['public_id', 'challenge_public_id', 'user__public_id']
    readonly_fields = [
        'public_id',
        'user',
        'challenge_public_id',
        'purpose',
        'event_type',
        'outcome',
        'reason_code',
        'occurred_at',
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

from django.contrib import admin
from django.utils import timezone

from . import services
from .models import (
    Company,
    CompanyDocument,
    CompanyImage,
    CompanyIndustry,
    CompanyUpdateRequest,
    EmployerPhoneVerificationEvent,
    Industry,
    RecruiterProfile,
    RecruitmentNeed,
)


@admin.register(Industry)
class IndustryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}


class CompanyIndustryInline(admin.TabularInline):
    model = CompanyIndustry
    extra = 0


class CompanyImageInline(admin.TabularInline):
    model = CompanyImage
    extra = 0


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = [
        'company_name',
        'tax_code',
        'business_type',
        'verification_status',
        'has_brand_page',
        'created_at',
    ]
    list_filter = ['verification_status', 'business_type', 'has_brand_page']
    list_editable = ['has_brand_page']
    search_fields = ['company_name', 'trade_name', 'tax_code', 'slug']
    prepopulated_fields = {'slug': ('company_name',)}
    inlines = [CompanyIndustryInline, CompanyImageInline]
    actions = ['approve_verification', 'reject_verification']

    @admin.action(description='Duyệt xác thực công ty đã chọn')
    def approve_verification(self, request, queryset):
        for company in queryset:
            services.verify_company(company, request.user, approve=True)

    @admin.action(description='Từ chối xác thực công ty đã chọn')
    def reject_verification(self, request, queryset):
        for company in queryset:
            services.verify_company(
                company, request.user, approve=False, reason='Từ chối qua admin'
            )


@admin.register(CompanyDocument)
class CompanyDocumentAdmin(admin.ModelAdmin):
    list_display = ['company', 'recruiter', 'doc_type', 'uploaded_by', 'status', 'created_at']
    list_filter = ['doc_type', 'status']
    search_fields = ['company__company_name', 'recruiter__user__email', 'uploaded_by__email']
    actions = ['approve_documents', 'reject_documents']

    def _review(self, request, queryset, status):
        for document in queryset.filter(
            status=CompanyDocument.Status.PENDING,
            is_current=True,
        ).select_related('verification_case', 'update_request'):
            reason = '' if status == CompanyDocument.Status.APPROVED else 'Từ chối qua admin'
            if document.verification_case_id:
                services.review_verification_document(
                    document,
                    actor=request.user,
                    decision=status,
                    reason=reason,
                    lock_version=document.verification_case.lock_version,
                )
            elif document.update_request_id:
                services.review_company_update_document(
                    document,
                    admin_user=request.user,
                    decision=status,
                    note=reason,
                    lock_version=document.update_request.lock_version,
                )
            else:
                document.status = status
                document.reviewed_by = request.user
                document.reviewed_at = timezone.now()
                document.review_note = reason
                document.save(
                    update_fields=[
                        'status',
                        'reviewed_by',
                        'reviewed_at',
                        'review_note',
                        'updated_at',
                    ]
                )

    @admin.action(description='Duyệt giấy tờ đã chọn')
    def approve_documents(self, request, queryset):
        self._review(request, queryset, CompanyDocument.Status.APPROVED)

    @admin.action(description='Từ chối giấy tờ đã chọn')
    def reject_documents(self, request, queryset):
        self._review(request, queryset, CompanyDocument.Status.REJECTED)


@admin.register(CompanyUpdateRequest)
class CompanyUpdateRequestAdmin(admin.ModelAdmin):
    list_display = ['company', 'requested_by', 'is_sensitive', 'status', 'created_at']
    list_filter = ['status', 'is_sensitive']
    search_fields = ['company__company_name', 'requested_by__email']
    actions = ['approve_requests', 'reject_requests']
    readonly_fields = ['public_id', 'submitted_at', 'created_at', 'updated_at']

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj is not None:
            fields.append('requested_by')
        return fields

    @admin.action(description='Duyệt và áp thay đổi vào công ty')
    def approve_requests(self, request, queryset):
        for update_request in queryset.filter(status=CompanyUpdateRequest.Status.PENDING):
            services.apply_update_request(update_request, request.user, approve=True)

    @admin.action(description='Từ chối yêu cầu cập nhật đã chọn')
    def reject_requests(self, request, queryset):
        for update_request in queryset.filter(status=CompanyUpdateRequest.Status.PENDING):
            services.apply_update_request(
                update_request, request.user, approve=False, note='Từ chối qua admin'
            )


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
        'verified_phone',
        'phone_verified_at',
        'registration_completed_at',
        'terms_accepted_at',
        'terms_policy_version',
        'marketing_decided_at',
        'created_at',
        'updated_at',
    ]


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

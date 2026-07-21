from django.contrib import admin
from django.utils import timezone

from . import services
from .models import (
    Company,
    CompanyDocument,
    CompanyImage,
    CompanyIndustry,
    CompanyUpdateRequest,
    Industry,
    RecruitmentNeed,
    RecruiterProfile,
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
        queryset.filter(status=CompanyDocument.Status.PENDING).update(
            status=status, reviewed_by=request.user, reviewed_at=timezone.now()
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

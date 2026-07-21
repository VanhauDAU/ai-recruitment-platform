from django.contrib import admin

from .models import ConsultationLead, ServiceCategory, ServicePackage


class ServicePackageInline(admin.TabularInline):
    model = ServicePackage
    extra = 0
    fields = ['slug', 'name_vi', 'price', 'is_highlight', 'cta_type', 'order', 'is_active']


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ['name_vi', 'key', 'order', 'is_active']
    list_editable = ['order', 'is_active']
    search_fields = ['key', 'name_vi', 'name_en']
    inlines = [ServicePackageInline]


@admin.register(ServicePackage)
class ServicePackageAdmin(admin.ModelAdmin):
    list_display = ['name_vi', 'slug', 'category', 'price', 'is_highlight', 'order', 'is_active']
    list_filter = ['category', 'is_highlight', 'is_active']
    list_editable = ['order', 'is_active']
    search_fields = ['slug', 'name_vi', 'name_en']


@admin.register(ConsultationLead)
class ConsultationLeadAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'full_name', 'company_name', 'phone', 'email', 'need', 'status']
    list_filter = ['status', 'need', 'created_at']
    list_editable = ['status']
    search_fields = ['full_name', 'company_name', 'email', 'phone']
    readonly_fields = [
        'full_name',
        'company_name',
        'email',
        'phone',
        'province',
        'need',
        'note',
        'source_page',
        'created_at',
    ]

    def has_add_permission(self, request):
        return False

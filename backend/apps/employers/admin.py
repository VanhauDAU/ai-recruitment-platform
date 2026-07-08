from django.contrib import admin

from .models import EmployerProfile, Industry


@admin.register(Industry)
class IndustryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(EmployerProfile)
class EmployerProfileAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'user', 'status', 'industry_names', 'created_at']
    list_filter = ['status', 'industries']
    search_fields = ['company_name', 'user__email', 'tax_code']
    prepopulated_fields = {'slug': ('company_name',)}
    filter_horizontal = ['industries']

    @admin.display(description='Lĩnh vực')
    def industry_names(self, obj):
        return ', '.join(i.name for i in obj.industries.all())

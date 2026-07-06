from django.contrib import admin

from .models import EmployerProfile


@admin.register(EmployerProfile)
class EmployerProfileAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'user', 'status', 'industry', 'created_at']
    list_filter = ['status', 'industry']
    search_fields = ['company_name', 'user__email', 'tax_code']
    prepopulated_fields = {'slug': ('company_name',)}

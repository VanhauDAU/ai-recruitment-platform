from django.contrib import admin

from .models import CvTemplate


@admin.register(CvTemplate)
class CvTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'is_premium', 'status', 'usage_count', 'sort_order']
    list_filter = ['category', 'is_premium', 'status']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['public_id', 'usage_count']

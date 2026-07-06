from django.contrib import admin

from .models import Application


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'job', 'status', 'applied_at']
    list_filter = ['status', 'source']
    search_fields = ['candidate__email', 'job__title']
    readonly_fields = ['public_id', 'applied_at', 'updated_at']

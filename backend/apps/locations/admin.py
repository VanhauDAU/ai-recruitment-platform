from django.contrib import admin

from .models import Location


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ['name', 'level', 'parent', 'code', 'is_active']
    list_filter = ['level', 'is_active']
    search_fields = ['name', 'code']
    prepopulated_fields = {'slug': ('name',)}
    autocomplete_fields = ['parent']

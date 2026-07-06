from django.contrib import admin

from .models import Skill


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'is_active']
    list_filter = ['category', 'is_active']
    search_fields = ['name', 'normalized_name', 'aliases']
    prepopulated_fields = {'slug': ('name',)}

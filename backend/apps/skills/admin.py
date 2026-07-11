from django.contrib import admin

from .models import Skill, SkillGroup


@admin.register(SkillGroup)
class SkillGroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'parent', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ['name', 'group', 'is_active']
    list_filter = ['group', 'is_active']
    search_fields = ['name', 'normalized_name', 'aliases']
    prepopulated_fields = {'slug': ('name',)}

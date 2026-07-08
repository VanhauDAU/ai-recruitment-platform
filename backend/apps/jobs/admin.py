from django.contrib import admin
from django.utils.html import format_html

from .models import Job, JobCategory, JobSkill


@admin.register(JobCategory)
class JobCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'parent', 'logo_preview', 'status']
    list_filter = ['status']
    search_fields = ['name', 'logo_url']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['logo_preview']
    fieldsets = (
        (None, {'fields': ('name', 'slug', 'description', 'parent', 'status')}),
        ('Homepage display', {'fields': ('logo_url', 'logo_preview')}),
    )

    @admin.display(description='Logo')
    def logo_preview(self, obj):
        if not obj.logo_url:
            return '-'
        return format_html(
            '<img src="{}" alt="{}" style="height: 36px; max-width: 72px; object-fit: contain;" />',
            obj.logo_url,
            obj.name,
        )


class JobSkillInline(admin.TabularInline):
    model = JobSkill
    extra = 0


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ['title', 'employer_profile', 'status', 'work_type', 'position_level', 'experience_years', 'created_at']
    list_filter = ['status', 'work_type', 'employment_type', 'experience_level', 'position_level', 'experience_years', 'weekend_policy']
    search_fields = ['title', 'employer_profile__company_name']
    readonly_fields = ['public_id', 'view_count', 'application_count']
    filter_horizontal = ['locations']
    inlines = [JobSkillInline]


@admin.register(JobSkill)
class JobSkillAdmin(admin.ModelAdmin):
    list_display = ['job', 'skill', 'importance', 'weight']
    list_filter = ['importance']

from django.contrib import admin

from .models import Job, JobCategory, JobSkill


@admin.register(JobCategory)
class JobCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'parent', 'status']
    list_filter = ['status']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}


class JobSkillInline(admin.TabularInline):
    model = JobSkill
    extra = 0


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ['title', 'employer_profile', 'status', 'work_type', 'experience_level', 'created_at']
    list_filter = ['status', 'work_type', 'employment_type', 'experience_level']
    search_fields = ['title', 'employer_profile__company_name']
    readonly_fields = ['public_id', 'view_count', 'application_count']
    filter_horizontal = ['locations']
    inlines = [JobSkillInline]


@admin.register(JobSkill)
class JobSkillAdmin(admin.ModelAdmin):
    list_display = ['job', 'skill', 'importance', 'weight']
    list_filter = ['importance']

from django import forms
from django.contrib import admin
from django.utils.html import format_html

from common.media_storage import delete_local_media_url, media_url_from_value, save_image_upload

from .models import Job, JobCategory, JobSkill, SavedJob


class JobCategoryAdminForm(forms.ModelForm):
    upload_logo = forms.FileField(
        required=False,
        help_text='Upload logo vào storage nội bộ. Nếu có file mới, hệ thống sẽ cập nhật logo_url.',
    )

    class Meta:
        model = JobCategory
        fields = '__all__'


@admin.register(JobCategory)
class JobCategoryAdmin(admin.ModelAdmin):
    form = JobCategoryAdminForm
    list_display = ['name', 'parent', 'logo_preview', 'status']
    list_filter = ['status']
    search_fields = ['name', 'logo_url']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['logo_preview']
    fieldsets = (
        (None, {'fields': ('name', 'slug', 'description', 'parent', 'status')}),
        ('Homepage display', {'fields': ('upload_logo', 'logo_url', 'logo_preview')}),
    )

    def save_model(self, request, obj, form, change):
        upload = form.cleaned_data.get('upload_logo')
        old_url = JobCategory.objects.filter(pk=obj.pk).values_list('logo_url', flat=True).first() if change else ''
        if upload:
            saved = save_image_upload(upload, 'jobs/categories/logos', request=request)
            obj.logo_url = saved['path']
        super().save_model(request, obj, form, change)
        if old_url != obj.logo_url:
            delete_local_media_url(old_url)

    @admin.display(description='Logo')
    def logo_preview(self, obj):
        if not obj.logo_url:
            return '-'
        return format_html(
            '<img src="{}" alt="{}" style="height: 36px; max-width: 72px; object-fit: contain;" />',
            media_url_from_value(obj.logo_url, request=None),
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


@admin.register(SavedJob)
class SavedJobAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'job', 'created_at']
    search_fields = ['candidate__email', 'job__title']
    autocomplete_fields = ['job']
    readonly_fields = ['created_at']

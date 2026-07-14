from django.contrib import admin

from .models import (
    CvCategory,
    CvColor,
    CvContentBlueprint,
    CvSampleContent,
    CvTemplate,
    CvTemplateCategoryLink,
    CvTemplateColorLink,
)


class CvTemplateCategoryInline(admin.TabularInline):
    model = CvTemplateCategoryLink
    extra = 1


class CvTemplateColorInline(admin.TabularInline):
    model = CvTemplateColorLink
    extra = 1


@admin.register(CvTemplate)
class CvTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_premium', 'status', 'lifecycle_status', 'usage_count', 'sort_order']
    list_filter = ['is_premium', 'status', 'lifecycle_status', 'categories__category_type']
    search_fields = ['name']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['public_id', 'usage_count']
    inlines = [CvTemplateCategoryInline, CvTemplateColorInline]


@admin.register(CvCategory)
class CvCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'category_type', 'slug', 'is_active', 'sort_order']
    list_filter = ['category_type', 'is_active']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['public_id']


@admin.register(CvColor)
class CvColorAdmin(admin.ModelAdmin):
    list_display = ['name', 'hex_code', 'slug', 'is_active', 'sort_order']
    list_filter = ['is_active']
    search_fields = ['name', 'slug', 'hex_code']
    readonly_fields = ['public_id']


@admin.register(CvContentBlueprint)
class CvContentBlueprintAdmin(admin.ModelAdmin):
    list_display = ['locale', 'experience_level', 'is_active', 'updated_at']
    list_filter = ['locale', 'experience_level', 'is_active']
    search_fields = ['summary_title', 'summary_template', 'experience_title']
    readonly_fields = ['public_id', 'created_at', 'updated_at']

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(CvSampleContent)
class CvSampleContentAdmin(admin.ModelAdmin):
    list_display = ['title', 'job_category', 'locale', 'experience_level', 'status', 'updated_at']
    list_filter = ['locale', 'experience_level', 'status']
    search_fields = ['title', 'position_name_vi', 'job_category__name']
    autocomplete_fields = ['job_category']
    readonly_fields = ['public_id', 'created_at', 'updated_at']

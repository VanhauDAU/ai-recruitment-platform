from django.contrib import admin

from .models import (
    CvCategory,
    CvColor,
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

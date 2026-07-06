from django.contrib import admin

from .models import CvSkill, UserCv


class CvSkillInline(admin.TabularInline):
    model = CvSkill
    extra = 0


@admin.register(UserCv)
class UserCvAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'cv_type', 'status', 'is_default', 'updated_at']
    list_filter = ['cv_type', 'status', 'is_default']
    search_fields = ['title', 'user__email']
    readonly_fields = ['public_id']
    inlines = [CvSkillInline]


@admin.register(CvSkill)
class CvSkillAdmin(admin.ModelAdmin):
    list_display = ['cv', 'skill', 'source', 'level']
    list_filter = ['source', 'level']

from django.contrib import admin

from .models import CandidateProfile


@admin.register(CandidateProfile)
class CandidateProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'desired_position', 'job_search_status', 'updated_at']
    list_filter = ['job_search_status', 'preferred_work_type']
    search_fields = ['user__email', 'desired_position', 'headline']

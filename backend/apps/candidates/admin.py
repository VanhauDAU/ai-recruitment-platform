from django.contrib import admin

from .models import (
    CandidateConsent,
    CandidateDesiredSpecialization,
    CandidateJobPreference,
    CandidatePreferredProvince,
    CandidateProfile,
)


@admin.register(CandidateProfile)
class CandidateProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'job_preferences_configured', 'desired_position', 'job_search_status', 'updated_at']
    list_filter = ['job_search_status', 'preferred_work_type']
    search_fields = ['user__email', 'desired_position', 'headline']


@admin.register(CandidateJobPreference)
class CandidateJobPreferenceAdmin(admin.ModelAdmin):
    list_display = ['candidate_profile', 'experience_level', 'desired_salary_vnd', 'updated_at']
    search_fields = ['candidate_profile__user__email', 'desired_position_other']


@admin.register(CandidateDesiredSpecialization)
class CandidateDesiredSpecializationAdmin(admin.ModelAdmin):
    list_display = ['job_preference', 'job_category', 'sort_order']


@admin.register(CandidatePreferredProvince)
class CandidatePreferredProvinceAdmin(admin.ModelAdmin):
    list_display = ['job_preference', 'location', 'sort_order']


@admin.register(CandidateConsent)
class CandidateConsentAdmin(admin.ModelAdmin):
    list_display = ['candidate_profile', 'consent_type', 'decision', 'policy_version', 'updated_at']
    list_filter = ['consent_type', 'decision']

"""Candidate-level gates shared by digest preparation and delivery."""

from apps.candidates.models import (
    CandidateConsent,
    CandidateEmailNotificationSettings,
    CandidateJobPreference,
    CandidateProfile,
)
from apps.sitecontent.selectors import business_emails_enabled, get_bool_setting


def site_email_enabled():
    """Email nghiệp vụ đang bật VÀ admin bật email gợi ý việc làm."""
    return business_emails_enabled() and get_bool_setting('job_alert_enabled', True)


def candidate_email_settings(user):
    value = (
        CandidateEmailNotificationSettings.objects.filter(candidate_profile__user=user)
        .only('configured_job_alerts', 'suitable_job_recommendations', 'followed_company_jobs')
        .first()
    )
    return {
        'configured': True if value is None else value.configured_job_alerts,
        'suitable': False if value is None else value.suitable_job_recommendations,
        'followed': True if value is None else value.followed_company_jobs,
    }


def suitable_prerequisites_allowed(user):
    profile = (
        CandidateProfile.objects.filter(user=user).only('id', 'job_preferences_configured').first()
    )
    if (
        not profile
        or not profile.job_preferences_configured
        or not CandidateJobPreference.objects.filter(candidate_profile=profile).exists()
    ):
        return False
    return CandidateConsent.objects.filter(
        candidate_profile=profile,
        consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
        decision=CandidateConsent.Decision.GRANTED,
    ).exists()

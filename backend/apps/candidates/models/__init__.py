"""Public model API for the candidates Django app."""

from .email_notifications import CandidateEmailNotificationSettings
from .profile import (
    CandidateConsent,
    CandidateConsentEvent,
    CandidateDesiredSpecialization,
    CandidateJobPreference,
    CandidatePreferredProvince,
    CandidateProfile,
)

__all__ = [
    'CandidateConsent',
    'CandidateConsentEvent',
    'CandidateDesiredSpecialization',
    'CandidateEmailNotificationSettings',
    'CandidateJobPreference',
    'CandidatePreferredProvince',
    'CandidateProfile',
]

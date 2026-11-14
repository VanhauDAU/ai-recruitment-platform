"""Public model API for the candidates Django app."""

from .email_notifications import CandidateEmailNotificationSettings
from .notifications import CandidateNotification
from .profile import (
    CandidateConsent,
    CandidateConsentEvent,
    CandidateDesiredPositionOther,
    CandidateDesiredSpecialization,
    CandidateJobPreference,
    CandidatePreferredProvince,
    CandidatePreferredSkill,
    CandidateProfile,
)

__all__ = [
    'CandidateConsent',
    'CandidateConsentEvent',
    'CandidateDesiredPositionOther',
    'CandidateDesiredSpecialization',
    'CandidateEmailNotificationSettings',
    'CandidateNotification',
    'CandidateJobPreference',
    'CandidatePreferredProvince',
    'CandidatePreferredSkill',
    'CandidateProfile',
]

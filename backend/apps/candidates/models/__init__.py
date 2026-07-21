"""Public model API for the candidates Django app."""

from .profile import (
    CandidateConsent,
    CandidateConsentEvent,
    CandidateDesiredSpecialization,
    CandidateJobPreference,
    CandidatePreferredProvince,
    CandidateProfile,
)

__all__ = ['CandidateConsent', 'CandidateConsentEvent', 'CandidateDesiredSpecialization', 'CandidateJobPreference', 'CandidatePreferredProvince', 'CandidateProfile']

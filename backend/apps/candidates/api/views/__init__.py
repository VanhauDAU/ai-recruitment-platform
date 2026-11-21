from .email_notifications import MyCandidateEmailNotificationSettingsView
from .notifications import (
    CandidateNotificationListView,
    CandidateNotificationReadAllView,
    CandidateNotificationReadView,
    CandidateNotificationUnreadCountView,
)
from .profile import (
    MyAiRecommendationView,
    MyCandidateJobPreferencesView,
    MyCandidateProfileView,
    MyRecruiterVisibilityView,
)

__all__ = [
    'CandidateNotificationListView',
    'CandidateNotificationReadAllView',
    'CandidateNotificationReadView',
    'CandidateNotificationUnreadCountView',
    'MyCandidateEmailNotificationSettingsView',
    'MyCandidateJobPreferencesView',
    'MyCandidateProfileView',
    'MyAiRecommendationView',
    'MyRecruiterVisibilityView',
]

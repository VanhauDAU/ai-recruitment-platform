from django.urls import path

from .api.views import (
    MyCandidateEmailNotificationSettingsView,
    MyCandidateJobPreferencesView,
    MyCandidateProfileView,
    MyRecruiterVisibilityView,
)

urlpatterns = [
    path('profile/', MyCandidateProfileView.as_view(), name='candidate-profile'),
    path(
        'email-notification-settings/',
        MyCandidateEmailNotificationSettingsView.as_view(),
        name='candidate-email-notification-settings',
    ),
    path(
        'job-preferences/',
        MyCandidateJobPreferencesView.as_view(),
        name='candidate-job-preferences',
    ),
    path(
        'recruiter-visibility/',
        MyRecruiterVisibilityView.as_view(),
        name='candidate-recruiter-visibility',
    ),
]

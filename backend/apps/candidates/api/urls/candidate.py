from django.urls import path

from ..views import (
    CandidateNotificationListView,
    CandidateNotificationReadAllView,
    CandidateNotificationReadView,
    CandidateNotificationUnreadCountView,
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
        'notifications/',
        CandidateNotificationListView.as_view(),
        name='candidate-notification-list',
    ),
    path(
        'notifications/unread-count/',
        CandidateNotificationUnreadCountView.as_view(),
        name='candidate-notification-unread-count',
    ),
    path(
        'notifications/read-all/',
        CandidateNotificationReadAllView.as_view(),
        name='candidate-notification-read-all',
    ),
    path(
        'notifications/<str:public_id>/read/',
        CandidateNotificationReadView.as_view(),
        name='candidate-notification-read',
    ),
    path(
        'recruiter-visibility/',
        MyRecruiterVisibilityView.as_view(),
        name='candidate-recruiter-visibility',
    ),
]

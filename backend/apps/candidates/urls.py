from django.urls import path

from .views import MyCandidateJobPreferencesView, MyCandidateProfileView

urlpatterns = [
    path('profile/', MyCandidateProfileView.as_view(), name='candidate-profile'),
    path('job-preferences/', MyCandidateJobPreferencesView.as_view(), name='candidate-job-preferences'),
]

from django.urls import path

from .views import MyCandidateProfileView

urlpatterns = [
    path('profile/', MyCandidateProfileView.as_view(), name='candidate-profile'),
]

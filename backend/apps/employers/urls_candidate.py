"""Candidate-owned employer resources, mounted under ``/api/candidate/``."""

from django.urls import path

from .api.views import FollowedCompanyListView

urlpatterns = [
    path(
        'followed-companies/',
        FollowedCompanyListView.as_view(),
        name='candidate-followed-companies',
    ),
]

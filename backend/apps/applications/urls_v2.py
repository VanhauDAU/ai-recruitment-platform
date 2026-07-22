from django.urls import path

from .api.views.employer import (
    EmployerApplicationHistoryView,
    EmployerApplicationListView,
    EmployerApplicationStatusUpdateView,
)
from .api.views.v2 import CandidateApplicationV2ListCreateView, RecruiterApplicationSnapshotView

urlpatterns = [
    path(
        'applications/',
        CandidateApplicationV2ListCreateView.as_view(),
        name='candidate-application-list-create-v2',
    ),
    path(
        'recruiter/applications/',
        EmployerApplicationListView.as_view(),
        name='recruiter-application-list-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/',
        EmployerApplicationStatusUpdateView.as_view(),
        name='recruiter-application-status-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/cv/',
        RecruiterApplicationSnapshotView.as_view(),
        name='recruiter-application-snapshot-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/history/',
        EmployerApplicationHistoryView.as_view(),
        name='recruiter-application-history-v2',
    ),
]

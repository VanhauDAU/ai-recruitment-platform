from django.urls import path

from .api.views.v2 import CandidateApplicationV2ListCreateView, RecruiterApplicationSnapshotView

urlpatterns = [
    path(
        'applications/',
        CandidateApplicationV2ListCreateView.as_view(),
        name='candidate-application-list-create-v2',
    ),
    path(
        'recruiter/applications/<str:public_id>/cv/',
        RecruiterApplicationSnapshotView.as_view(),
        name='recruiter-application-snapshot-v2',
    ),
]

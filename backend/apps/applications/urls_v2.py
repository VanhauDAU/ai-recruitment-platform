from django.urls import path

from .api_v2_views import RecruiterApplicationSnapshotView


urlpatterns = [
    path(
        'recruiter/applications/<str:public_id>/cv/',
        RecruiterApplicationSnapshotView.as_view(),
        name='recruiter-application-snapshot-v2',
    ),
]

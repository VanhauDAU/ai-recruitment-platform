from django.urls import path

from ..views import (
    AnnouncementStateView,
)

urlpatterns = [
    path(
        'announcements/<str:public_id>/state/',
        AnnouncementStateView.as_view(),
        name='site-announcement-state',
    ),
]

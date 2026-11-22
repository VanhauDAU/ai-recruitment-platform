from django.urls import path

from ..views import (
    AnnouncementInboxView,
    AnnouncementStateView,
)

urlpatterns = [
    path(
        'announcements/inbox/',
        AnnouncementInboxView.as_view(),
        name='site-announcement-inbox',
    ),
    path(
        'announcements/<str:public_id>/state/',
        AnnouncementStateView.as_view(),
        name='site-announcement-state',
    ),
]

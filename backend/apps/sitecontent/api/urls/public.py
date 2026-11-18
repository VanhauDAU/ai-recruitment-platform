from django.urls import path

from ..views import (
    ActiveAnnouncementListView,
    AnnouncementEventBatchView,
    AnnouncementRuntimeEventView,
    BannerListView,
    FeedbackCreateView,
    LinkGroupListView,
    SiteSettingListView,
)

urlpatterns = [
    path(
        'announcements/active/',
        ActiveAnnouncementListView.as_view(),
        name='site-announcements-active',
    ),
    path(
        'announcements/events/',
        AnnouncementEventBatchView.as_view(),
        name='site-announcement-events',
    ),
    path(
        'announcements/runtime-events/',
        AnnouncementRuntimeEventView.as_view(),
        name='site-announcement-runtime-events',
    ),
    path('settings/', SiteSettingListView.as_view(), name='site-settings'),
    path('link-groups/', LinkGroupListView.as_view(), name='site-link-groups'),
    path('banners/', BannerListView.as_view(), name='site-banners'),
    path('feedback/', FeedbackCreateView.as_view(), name='site-feedback'),
]

from django.urls import path

from .api.views import (
    ActiveAnnouncementListView,
    AdminAnnouncementArchiveView,
    AdminAnnouncementBackgroundUploadView,
    AdminAnnouncementDetailView,
    AdminAnnouncementDuplicateView,
    AdminAnnouncementListCreateView,
    AdminAnnouncementMetricView,
    AdminAnnouncementPauseView,
    AdminAnnouncementPublishView,
    AdminAnnouncementResetDismissalsView,
    AdminAnnouncementResumeView,
    AdminAnnouncementRevisionCreateView,
    AdminLocaleDetailView,
    AdminLocaleListCreateView,
    AdminSettingUploadView,
    AdminSiteSettingView,
    AnnouncementEventBatchView,
    AnnouncementRuntimeEventView,
    AnnouncementStateView,
    BannerListView,
    FeedbackCreateView,
    LinkGroupListView,
    LocaleListView,
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
    path(
        'announcements/<str:public_id>/state/',
        AnnouncementStateView.as_view(),
        name='site-announcement-state',
    ),
    path(
        'admin/announcements/',
        AdminAnnouncementListCreateView.as_view(),
        name='site-admin-announcements',
    ),
    path(
        'admin/announcements/backgrounds/',
        AdminAnnouncementBackgroundUploadView.as_view(),
        name='site-admin-announcement-backgrounds',
    ),
    path(
        'admin/announcements/<str:public_id>/',
        AdminAnnouncementDetailView.as_view(),
        name='site-admin-announcement-detail',
    ),
    path(
        'admin/announcements/<str:public_id>/revisions/',
        AdminAnnouncementRevisionCreateView.as_view(),
        name='site-admin-announcement-revisions',
    ),
    path(
        'admin/announcements/<str:public_id>/publish/',
        AdminAnnouncementPublishView.as_view(),
        name='site-admin-announcement-publish',
    ),
    path(
        'admin/announcements/<str:public_id>/pause/',
        AdminAnnouncementPauseView.as_view(),
        name='site-admin-announcement-pause',
    ),
    path(
        'admin/announcements/<str:public_id>/resume/',
        AdminAnnouncementResumeView.as_view(),
        name='site-admin-announcement-resume',
    ),
    path(
        'admin/announcements/<str:public_id>/archive/',
        AdminAnnouncementArchiveView.as_view(),
        name='site-admin-announcement-archive',
    ),
    path(
        'admin/announcements/<str:public_id>/reset-dismissals/',
        AdminAnnouncementResetDismissalsView.as_view(),
        name='site-admin-announcement-reset-dismissals',
    ),
    path(
        'admin/announcements/<str:public_id>/duplicate/',
        AdminAnnouncementDuplicateView.as_view(),
        name='site-admin-announcement-duplicate',
    ),
    path(
        'admin/announcements/<str:public_id>/metrics/',
        AdminAnnouncementMetricView.as_view(),
        name='site-admin-announcement-metrics',
    ),
    path('settings/', SiteSettingListView.as_view(), name='site-settings'),
    path('locales/', LocaleListView.as_view(), name='site-locales'),
    path('admin/locales/', AdminLocaleListCreateView.as_view(), name='site-admin-locales'),
    path(
        'admin/locales/<str:code>/',
        AdminLocaleDetailView.as_view(),
        name='site-admin-locale-detail',
    ),
    path('admin/settings/', AdminSiteSettingView.as_view(), name='site-admin-settings'),
    path(
        'admin/settings/upload/',
        AdminSettingUploadView.as_view(),
        name='site-admin-settings-upload',
    ),
    path('link-groups/', LinkGroupListView.as_view(), name='site-link-groups'),
    path('banners/', BannerListView.as_view(), name='site-banners'),
    path('feedback/', FeedbackCreateView.as_view(), name='site-feedback'),
]

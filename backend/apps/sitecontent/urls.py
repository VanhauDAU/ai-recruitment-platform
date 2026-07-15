from django.urls import path

from .views import (
    AdminSettingUploadView,
    AdminLocaleDetailView,
    AdminLocaleListCreateView,
    AdminSiteSettingView,
    BannerListView,
    FeedbackCreateView,
    LinkGroupListView,
    LocaleListView,
    SiteSettingListView,
)

urlpatterns = [
    path('settings/', SiteSettingListView.as_view(), name='site-settings'),
    path('locales/', LocaleListView.as_view(), name='site-locales'),
    path('admin/locales/', AdminLocaleListCreateView.as_view(), name='site-admin-locales'),
    path('admin/locales/<str:code>/', AdminLocaleDetailView.as_view(), name='site-admin-locale-detail'),
    path('admin/settings/', AdminSiteSettingView.as_view(), name='site-admin-settings'),
    path('admin/settings/upload/', AdminSettingUploadView.as_view(), name='site-admin-settings-upload'),
    path('link-groups/', LinkGroupListView.as_view(), name='site-link-groups'),
    path('banners/', BannerListView.as_view(), name='site-banners'),
    path('feedback/', FeedbackCreateView.as_view(), name='site-feedback'),
]

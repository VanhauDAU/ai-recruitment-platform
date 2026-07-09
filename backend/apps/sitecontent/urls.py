from django.urls import path

from .views import (
    AdminSettingUploadView,
    AdminSiteSettingView,
    BannerListView,
    LinkGroupListView,
    SiteSettingListView,
)

urlpatterns = [
    path('settings/', SiteSettingListView.as_view(), name='site-settings'),
    path('admin/settings/', AdminSiteSettingView.as_view(), name='site-admin-settings'),
    path('admin/settings/upload/', AdminSettingUploadView.as_view(), name='site-admin-settings-upload'),
    path('link-groups/', LinkGroupListView.as_view(), name='site-link-groups'),
    path('banners/', BannerListView.as_view(), name='site-banners'),
]

from django.urls import path

from .views import BannerListView, LinkGroupListView, SiteSettingListView

urlpatterns = [
    path('settings/', SiteSettingListView.as_view(), name='site-settings'),
    path('link-groups/', LinkGroupListView.as_view(), name='site-link-groups'),
    path('banners/', BannerListView.as_view(), name='site-banners'),
]

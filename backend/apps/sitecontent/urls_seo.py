from django.urls import path, re_path

from .api.views.seo import (
    RobotsView,
    SitemapIndexView,
    StaticSeoShellView,
    StaticSitemapView,
)

urlpatterns = [
    path('', StaticSeoShellView.as_view(), name='seo-home'),
    path('robots.txt', RobotsView.as_view(), name='seo-robots'),
    path('sitemap.xml', SitemapIndexView.as_view(), name='seo-sitemap-index'),
    path('sitemaps/static.xml', StaticSitemapView.as_view(), name='seo-sitemap-static'),
    path('chinh-sach-cookie', StaticSeoShellView.as_view(), name='seo-cookie-policy'),
    re_path(
        r'^tuyendung(?:/(?:gioi-thieu|dich-vu|bao-gia|lien-he|'
        r'dieu-khoan-dich-vu|chinh-sach-quyen-rieng))?$',
        StaticSeoShellView.as_view(),
        name='seo-employer-marketing',
    ),
]

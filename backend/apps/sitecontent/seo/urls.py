from django.urls import path, re_path

from apps.sitecontent.seo.views import (
    CompanySearchSeoShellView,
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
    re_path(
        r'^cong-ty/?$',
        StaticSeoShellView.as_view(),
        name='seo-company-directory',
    ),
    re_path(
        r'^cong-ty/tim-kiem/?$',
        CompanySearchSeoShellView.as_view(),
        name='seo-company-search',
    ),
    path('chinh-sach-cookie', StaticSeoShellView.as_view(), name='seo-cookie-policy'),
    re_path(
        r'^tuyendung(?:/(?:gioi-thieu|dich-vu|lien-he|'
        r'dieu-khoan-dich-vu|chinh-sach-quyen-rieng))?$',
        StaticSeoShellView.as_view(),
        name='seo-employer-marketing',
    ),
]

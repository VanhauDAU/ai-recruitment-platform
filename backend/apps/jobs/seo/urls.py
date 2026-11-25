from django.urls import path

from apps.jobs.seo.views import (
    JobDetailSeoShellView,
    JobListSeoShellView,
    JobSitemapView,
    NearbyJobsSeoShellView,
)

urlpatterns = [
    path('sitemaps/jobs.xml', JobSitemapView.as_view(), name='seo-sitemap-jobs'),
    path('viec-lam', JobListSeoShellView.as_view(), name='seo-job-list'),
    path('viec-lam-gan-ban', NearbyJobsSeoShellView.as_view(), name='seo-nearby-jobs'),
    path(
        'viec-lam/tai/<slug:location_slug>',
        JobListSeoShellView.as_view(),
        name='seo-job-location',
    ),
    path('viec-lam/<slug:slug>', JobDetailSeoShellView.as_view(), name='seo-job-detail'),
    path(
        'brand/<slug:company_slug>/tuyen-dung/<slug:slug>',
        JobDetailSeoShellView.as_view(),
        name='seo-job-detail-brand',
    ),
]

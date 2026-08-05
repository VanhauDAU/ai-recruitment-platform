from django.urls import path

from .api.views.seo import JobDetailSeoShellView, JobListSeoShellView, JobSitemapView

urlpatterns = [
    path('sitemaps/jobs.xml', JobSitemapView.as_view(), name='seo-sitemap-jobs'),
    path('viec-lam', JobListSeoShellView.as_view(), name='seo-job-list'),
    path(
        'viec-lam/tai/<slug:location_slug>',
        JobListSeoShellView.as_view(),
        name='seo-job-location',
    ),
    path('viec-lam/<slug:slug>', JobDetailSeoShellView.as_view(), name='seo-job-detail'),
    path('jobs', JobListSeoShellView.as_view(), name='seo-job-list-legacy'),
    path('jobs/<slug:slug>', JobDetailSeoShellView.as_view(), name='seo-job-detail-legacy'),
    path(
        'brand/<slug:company_slug>/tuyen-dung/<slug:slug>',
        JobDetailSeoShellView.as_view(),
        name='seo-job-detail-brand',
    ),
]

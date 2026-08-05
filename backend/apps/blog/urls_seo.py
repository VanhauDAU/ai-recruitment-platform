from django.urls import path

from .api.views.seo import (
    BlogCategorySeoShellView,
    BlogDetailSeoShellView,
    BlogHomeSeoShellView,
    BlogSitemapView,
)

urlpatterns = [
    path('sitemaps/blog.xml', BlogSitemapView.as_view(), name='seo-sitemap-blog'),
    path('blog', BlogHomeSeoShellView.as_view(), name='seo-blog-home'),
    path(
        'blog/danh-muc/<slug:slug>',
        BlogCategorySeoShellView.as_view(),
        name='seo-blog-category',
    ),
    path('blog/<slug:slug>', BlogDetailSeoShellView.as_view(), name='seo-blog-detail'),
]

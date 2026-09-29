from django.urls import path

from .api.views.seo import (
    KnowledgeCategorySeoShellView,
    KnowledgeDetailSeoShellView,
    KnowledgeHomeSeoShellView,
    KnowledgeSitemapView,
)

urlpatterns = [
    path(
        'sitemaps/knowledgebase.xml',
        KnowledgeSitemapView.as_view(),
        name='seo-sitemap-knowledgebase',
    ),
    path('tro-giup', KnowledgeHomeSeoShellView.as_view(), name='seo-knowledge-home'),
    path(
        'tro-giup/<slug:category_slug>',
        KnowledgeCategorySeoShellView.as_view(),
        name='seo-knowledge-category',
    ),
    path(
        'tro-giup/<slug:category_slug>/<slug:article_slug>',
        KnowledgeDetailSeoShellView.as_view(),
        name='seo-knowledge-detail',
    ),
]

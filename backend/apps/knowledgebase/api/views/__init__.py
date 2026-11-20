"""Knowledgebase API views."""

from .admin_articles import (
    AdminArticleArchiveView,
    AdminArticleDetailView,
    AdminArticleListCreateView,
    AdminArticlePublishView,
    AdminArticleReorderView,
    AdminArticleRestoreView,
    AdminArticleSummaryView,
    AdminRevisionDetailView,
    AdminRevisionDiscardView,
    AdminRevisionListCreateView,
)
from .admin_categories import (
    AdminCategoryActivateView,
    AdminCategoryDeactivateView,
    AdminCategoryDetailView,
    AdminCategoryListCreateView,
    AdminCategoryReorderView,
)
from .admin_media import (
    AdminMediaListCreateView,
)
from .public import (
    PublicArticleDetailView,
    PublicArticleListView,
    PublicCategoryListView,
)

__all__ = [
    'AdminArticleArchiveView',
    'AdminArticleDetailView',
    'AdminArticleListCreateView',
    'AdminArticlePublishView',
    'AdminArticleReorderView',
    'AdminArticleRestoreView',
    'AdminArticleSummaryView',
    'AdminCategoryActivateView',
    'AdminCategoryDeactivateView',
    'AdminCategoryDetailView',
    'AdminCategoryListCreateView',
    'AdminCategoryReorderView',
    'AdminMediaListCreateView',
    'AdminRevisionDiscardView',
    'AdminRevisionDetailView',
    'AdminRevisionListCreateView',
    'PublicArticleDetailView',
    'PublicArticleListView',
    'PublicCategoryListView',
]

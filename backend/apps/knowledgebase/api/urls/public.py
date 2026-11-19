from django.urls import path

from ..views import (
    PublicArticleDetailView,
    PublicArticleListView,
    PublicCategoryListView,
)

urlpatterns = [
    path('categories/', PublicCategoryListView.as_view(), name='kb-public-category-list'),
    path('articles/', PublicArticleListView.as_view(), name='kb-public-article-list'),
    path(
        'articles/<slug:category_slug>/<slug:article_slug>/',
        PublicArticleDetailView.as_view(),
        name='kb-public-article-detail',
    ),
]

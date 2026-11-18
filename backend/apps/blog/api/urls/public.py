from django.urls import path

from ..views import (
    BlogHomeView,
    PinnedPostListView,
    PostCategoryListView,
    PostDetailView,
    PostListView,
)

urlpatterns = [
    path('home/', BlogHomeView.as_view(), name='blog-home'),
    path('categories/', PostCategoryListView.as_view(), name='blog-category-list'),
    path('pinned/', PinnedPostListView.as_view(), name='blog-pinned-list'),
    path('', PostListView.as_view(), name='blog-post-list'),
    path('<slug:slug>/', PostDetailView.as_view(), name='blog-post-detail'),
]

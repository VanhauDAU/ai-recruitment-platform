from django.urls import path

from .api.views import (
    BlogHomeView,
    BlogImageUploadView,
    PinnedPostListView,
    PostCategoryListView,
    PostDetailView,
    PostListView,
)

urlpatterns = [
    path('home/', BlogHomeView.as_view(), name='blog-home'),
    path('categories/', PostCategoryListView.as_view(), name='blog-category-list'),
    path('pinned/', PinnedPostListView.as_view(), name='blog-pinned-list'),
    path('admin/uploads/', BlogImageUploadView.as_view(), name='blog-image-upload'),
    path('', PostListView.as_view(), name='blog-post-list'),
    path('<slug:slug>/', PostDetailView.as_view(), name='blog-post-detail'),
]

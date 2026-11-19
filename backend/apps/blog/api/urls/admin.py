from django.urls import path

from ..views import (
    AdminCategoryDetailView,
    AdminCategoryListCreateView,
    AdminCategoryReorderView,
    AdminPinDetailView,
    AdminPinListCreateView,
    AdminPinReorderView,
    AdminPostArchiveView,
    AdminPostDetailView,
    AdminPostDiscardDraftView,
    AdminPostDraftView,
    AdminPostListCreateView,
    AdminPostPublishView,
    AdminPostRestoreView,
    AdminPostReturnView,
    AdminPostSubmitView,
    AdminPostSummaryView,
    AdminTagDetailView,
    AdminTagListCreateView,
    AdminTagMergeView,
    BlogImageUploadView,
    BlogThumbnailUploadView,
)

urlpatterns = [
    path('uploads/', BlogImageUploadView.as_view(), name='blog-image-upload'),
    path('thumbnails/', BlogThumbnailUploadView.as_view(), name='blog-thumbnail-upload'),
    path('posts/summary/', AdminPostSummaryView.as_view(), name='blog-admin-post-summary'),
    path('posts/', AdminPostListCreateView.as_view(), name='blog-admin-post-list'),
    path('posts/<str:public_id>/', AdminPostDetailView.as_view(), name='blog-admin-post-detail'),
    path(
        'posts/<str:public_id>/draft/',
        AdminPostDraftView.as_view(),
        name='blog-admin-post-draft',
    ),
    path(
        'posts/<str:public_id>/submit/',
        AdminPostSubmitView.as_view(),
        name='blog-admin-post-submit',
    ),
    path(
        'posts/<str:public_id>/return/',
        AdminPostReturnView.as_view(),
        name='blog-admin-post-return',
    ),
    path(
        'posts/<str:public_id>/publish/',
        AdminPostPublishView.as_view(),
        name='blog-admin-post-publish',
    ),
    path(
        'posts/<str:public_id>/archive/',
        AdminPostArchiveView.as_view(),
        name='blog-admin-post-archive',
    ),
    path(
        'posts/<str:public_id>/restore/',
        AdminPostRestoreView.as_view(),
        name='blog-admin-post-restore',
    ),
    path(
        'posts/<str:public_id>/discard-draft/',
        AdminPostDiscardDraftView.as_view(),
        name='blog-admin-post-discard-draft',
    ),
    path('categories/', AdminCategoryListCreateView.as_view(), name='blog-admin-category-list'),
    path(
        'categories/reorder/',
        AdminCategoryReorderView.as_view(),
        name='blog-admin-category-reorder',
    ),
    path(
        'categories/<str:public_id>/',
        AdminCategoryDetailView.as_view(),
        name='blog-admin-category-detail',
    ),
    path('tags/', AdminTagListCreateView.as_view(), name='blog-admin-tag-list'),
    path(
        'tags/<str:public_id>/merge/',
        AdminTagMergeView.as_view(),
        name='blog-admin-tag-merge',
    ),
    path('tags/<str:public_id>/', AdminTagDetailView.as_view(), name='blog-admin-tag-detail'),
    path('pins/', AdminPinListCreateView.as_view(), name='blog-admin-pin-list'),
    path('pins/reorder/', AdminPinReorderView.as_view(), name='blog-admin-pin-reorder'),
    path('pins/<str:public_id>/', AdminPinDetailView.as_view(), name='blog-admin-pin-detail'),
]

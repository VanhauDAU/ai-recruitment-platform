from django.urls import path

from .api.views import (
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
    BlogHomeView,
    BlogImageUploadView,
    BlogThumbnailUploadView,
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
    path('admin/thumbnails/', BlogThumbnailUploadView.as_view(), name='blog-thumbnail-upload'),
    path('admin/posts/summary/', AdminPostSummaryView.as_view(), name='blog-admin-post-summary'),
    path('admin/posts/', AdminPostListCreateView.as_view(), name='blog-admin-post-list'),
    path(
        'admin/posts/<str:public_id>/', AdminPostDetailView.as_view(), name='blog-admin-post-detail'
    ),
    path(
        'admin/posts/<str:public_id>/draft/',
        AdminPostDraftView.as_view(),
        name='blog-admin-post-draft',
    ),
    path(
        'admin/posts/<str:public_id>/submit/',
        AdminPostSubmitView.as_view(),
        name='blog-admin-post-submit',
    ),
    path(
        'admin/posts/<str:public_id>/return/',
        AdminPostReturnView.as_view(),
        name='blog-admin-post-return',
    ),
    path(
        'admin/posts/<str:public_id>/publish/',
        AdminPostPublishView.as_view(),
        name='blog-admin-post-publish',
    ),
    path(
        'admin/posts/<str:public_id>/archive/',
        AdminPostArchiveView.as_view(),
        name='blog-admin-post-archive',
    ),
    path(
        'admin/posts/<str:public_id>/restore/',
        AdminPostRestoreView.as_view(),
        name='blog-admin-post-restore',
    ),
    path(
        'admin/posts/<str:public_id>/discard-draft/',
        AdminPostDiscardDraftView.as_view(),
        name='blog-admin-post-discard-draft',
    ),
    path(
        'admin/categories/', AdminCategoryListCreateView.as_view(), name='blog-admin-category-list'
    ),
    path(
        'admin/categories/reorder/',
        AdminCategoryReorderView.as_view(),
        name='blog-admin-category-reorder',
    ),
    path(
        'admin/categories/<str:public_id>/',
        AdminCategoryDetailView.as_view(),
        name='blog-admin-category-detail',
    ),
    path('admin/tags/', AdminTagListCreateView.as_view(), name='blog-admin-tag-list'),
    path(
        'admin/tags/<str:public_id>/merge/',
        AdminTagMergeView.as_view(),
        name='blog-admin-tag-merge',
    ),
    path('admin/tags/<str:public_id>/', AdminTagDetailView.as_view(), name='blog-admin-tag-detail'),
    path('admin/pins/', AdminPinListCreateView.as_view(), name='blog-admin-pin-list'),
    path('admin/pins/reorder/', AdminPinReorderView.as_view(), name='blog-admin-pin-reorder'),
    path('admin/pins/<str:public_id>/', AdminPinDetailView.as_view(), name='blog-admin-pin-detail'),
    path('', PostListView.as_view(), name='blog-post-list'),
    path('<slug:slug>/', PostDetailView.as_view(), name='blog-post-detail'),
]

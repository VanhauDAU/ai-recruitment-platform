from django.db.models import Count

from common.db.search import search_q

from ..models import BlogMediaAsset, PinnedPost, Post, PostCategory, Tag


def admin_posts_queryset(*, actor, can_publish, params=None):
    params = params or {}
    queryset = Post.objects.select_related(
        'category',
        'author',
        'related_job_category',
        'working_copy',
        'working_copy__category',
        'working_copy__related_job_category',
    )
    if query := (params.get('q') or '').strip():
        queryset = queryset.filter(
            search_q('title', query) | search_q('slug', query) | search_q('summary', query)
        )
    if category := params.get('category'):
        queryset = queryset.filter(category__public_id=category)
    if author := params.get('author'):
        queryset = queryset.filter(author__public_id=author)
    if state := params.get('status'):
        if state == 'published_with_draft':
            queryset = queryset.filter(
                status=Post.Status.PUBLISHED,
                working_copy__status='draft',
            )
        elif state == 'published_with_pending':
            queryset = queryset.filter(
                status=Post.Status.PUBLISHED,
                working_copy__status='pending',
            )
        elif state == Post.Status.PUBLISHED:
            queryset = queryset.filter(status=state)
        else:
            queryset = queryset.filter(status=state)

    ordering = params.get('ordering')
    allowed_ordering = {
        'updated_at',
        '-updated_at',
        'published_at',
        '-published_at',
        'view_count',
        '-view_count',
    }
    return queryset.order_by(ordering if ordering in allowed_ordering else '-updated_at')


def admin_post_detail_queryset(*, actor, can_publish):
    return admin_posts_queryset(actor=actor, can_publish=can_publish).prefetch_related(
        'tags', 'working_copy__tags', 'status_history__actor'
    )


def admin_post_summary(*, actor, can_publish):
    queryset = Post.objects.all()
    return {
        'all': queryset.count(),
        Post.Status.DRAFT: queryset.filter(status=Post.Status.DRAFT).count(),
        Post.Status.PENDING: queryset.filter(status=Post.Status.PENDING).count(),
        Post.Status.PUBLISHED: queryset.filter(
            status=Post.Status.PUBLISHED, working_copy__isnull=True
        ).count(),
        'published_with_draft': queryset.filter(
            status=Post.Status.PUBLISHED, working_copy__status='draft'
        ).count(),
        'published_with_pending': queryset.filter(
            status=Post.Status.PUBLISHED, working_copy__status='pending'
        ).count(),
        Post.Status.ARCHIVED: queryset.filter(status=Post.Status.ARCHIVED).count(),
    }


def admin_categories_queryset():
    return PostCategory.objects.annotate(post_count=Count('posts', distinct=True))


def admin_tags_queryset(params=None):
    params = params or {}
    queryset = Tag.objects.annotate(
        post_count=Count('posts', distinct=True),
        working_copy_count=Count('working_copies', distinct=True),
    )
    if query := (params.get('q') or '').strip():
        queryset = queryset.filter(search_q('name', query) | search_q('slug', query))
    if active := params.get('is_active'):
        queryset = queryset.filter(is_active=active.lower() == 'true')
    return queryset.order_by('name')


def admin_pins_queryset():
    return PinnedPost.objects.select_related('post').order_by('placement', 'order', 'id')


def admin_media_queryset(params=None):
    params = params or {}
    queryset = BlogMediaAsset.objects.select_related('uploaded_by')
    if query := (params.get('q') or '').strip():
        queryset = queryset.filter(search_q('original_name', query))
    return queryset.order_by('-created_at', '-id')

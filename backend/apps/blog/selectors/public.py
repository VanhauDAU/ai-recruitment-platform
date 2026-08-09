from django.conf import settings
from django.db.models import Prefetch

from apps.speech.models import BlogSpeechAsset
from common.db.search import search_q

from ..models import PinnedPost, Post, PostCategory, Tag


def published_posts_queryset(params):
    """Bài đã xuất bản cho trang danh sách; lọc theo danh mục, thẻ, từ khóa.

    `params` là request.query_params: ?category=<slug>, ?tag=<slug>, ?q=<text>.
    """
    qs = (
        Post.objects.filter(status=Post.Status.PUBLISHED)
        .select_related('category')
        .only(
            'public_id',
            'title',
            'slug',
            'content',
            'summary',
            'thumbnail_url',
            'published_at',
            'category_id',
            'category__name',
            'category__slug',
            'category__description',
            'category__seo_title',
        )
    )
    if category := params.get('category'):
        qs = qs.filter(category__slug=category)
    if tag := params.get('tag'):
        qs = qs.filter(tags__slug=tag)
    if q := (params.get('q') or '').strip():
        qs = qs.filter(search_q('title', q) | search_q('content', q))
    return qs.distinct()


def _published_list_only():
    return (
        'public_id',
        'title',
        'slug',
        'content',
        'summary',
        'thumbnail_url',
        'published_at',
        'category_id',
        'category__name',
        'category__slug',
        'category__description',
        'category__seo_title',
    )


def published_post_detail_queryset():
    """Bài đã xuất bản kèm quan hệ cho trang chi tiết."""
    ready_speech_assets = BlogSpeechAsset.objects.filter(
        status=BlogSpeechAsset.Status.READY,
        model_revision=settings.SPEECH_MODEL_REVISION,
    ).only(
        'post_id',
        'post_revision',
        'storage_key',
        'mime_type',
        'duration_ms',
        'voice_id',
        'style',
    )
    return (
        Post.objects.filter(status=Post.Status.PUBLISHED)
        .select_related('category', 'related_job_category', 'author')
        .prefetch_related(
            Prefetch('tags', queryset=Tag.objects.filter(is_active=True)),
            Prefetch(
                'speech_assets',
                queryset=ready_speech_assets.order_by('created_at'),
                to_attr='prefetched_ready_speech_assets',
            ),
        )
        .only(
            'public_id',
            'title',
            'slug',
            'thumbnail_url',
            'content',
            'summary',
            'published_at',
            'updated_at',
            'seo_title',
            'seo_description',
            'edit_revision',
            'author_id',
            'author__full_name',
            'author__email',
            'category_id',
            'category__name',
            'category__slug',
            'category__description',
            'category__seo_title',
            'related_job_category_id',
            'related_job_category__name',
            'related_job_category__slug',
        )
    )


def related_published_posts(post, *, limit=6):
    """Bài liên quan: ưu tiên cùng category, bù bằng chung thẻ; loại bài hiện tại.

    Trả tối đa `limit` (mặc định 6). Không hứa đủ 3 nếu corpus còn mỏng.
    """
    if limit <= 0:
        return []

    base = (
        Post.objects.filter(status=Post.Status.PUBLISHED)
        .exclude(pk=post.pk)
        .select_related('category')
        .only(*_published_list_only())
        .order_by('-published_at', '-id')
    )
    related = list(base.filter(category_id=post.category_id)[:limit])
    if len(related) >= limit:
        return related[:limit]

    tag_ids = list(post.tags.values_list('pk', flat=True))
    if not tag_ids:
        return related

    seen = {item.pk for item in related}
    seen.add(post.pk)
    need = limit - len(related)
    extras = list(base.filter(tags__in=tag_ids).exclude(pk__in=seen).distinct()[:need])
    related.extend(extras)
    return related[:limit]


def active_categories():
    """Danh mục đang bật cho thanh danh mục ngang."""
    return PostCategory.objects.filter(is_active=True).only(
        'id', 'name', 'slug', 'description', 'seo_title'
    )


def blog_home_sections(per_section=4):
    """Dữ liệu trang /blog kiểu magazine trong 1 lần gọi.

    Trả về (featured, sections): featured là 4 bài mới nhất toàn trang; mỗi
    section là 1 danh mục đang bật kèm 4 bài mới nhất của nó (bỏ danh mục
    chưa có bài). Sliced prefetch dùng window function để số query không tăng
    theo số danh mục.
    """
    base = (
        Post.objects.filter(status=Post.Status.PUBLISHED)
        .select_related('category')
        .only(
            'public_id',
            'title',
            'slug',
            'content',
            'summary',
            'thumbnail_url',
            'published_at',
            'category_id',
            'category__name',
            'category__slug',
            'category__description',
            'category__seo_title',
        )
    )
    featured = list(base[:per_section])
    categories = active_categories().prefetch_related(
        Prefetch('posts', queryset=base[:per_section], to_attr='home_posts')
    )
    sections = [
        {'category': category, 'posts': category.home_posts}
        for category in categories
        if category.home_posts
    ]
    return featured, sections


def pinned_posts(placement=PinnedPost.Placement.SUPPORT_DOCS):
    """Bài ghim đang bật ở một vị trí, chỉ lấy bài đã xuất bản."""
    return (
        PinnedPost.objects.filter(
            placement=placement,
            is_active=True,
            post__status=Post.Status.PUBLISHED,
        )
        .select_related('post')
        .only('post__title', 'post__slug')
    )

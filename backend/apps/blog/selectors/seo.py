"""Small public projections used by HTML SEO routes and sitemaps."""

from common.seo import SITEMAP_URL_LIMIT

from ..models import Post, PostCategory
from .public import published_post_detail_queryset


def seo_post_by_slug(slug):
    return published_post_detail_queryset().filter(slug=slug).first()


def seo_category_by_slug(slug):
    return PostCategory.objects.filter(slug=slug, is_active=True).first()


def blog_sitemap_rows():
    posts = Post.objects.filter(status=Post.Status.PUBLISHED).values_list(
        'slug',
        'updated_at',
    )[:SITEMAP_URL_LIMIT]
    categories = PostCategory.objects.filter(is_active=True).values_list(
        'slug',
        'created_at',
    )
    return posts, categories

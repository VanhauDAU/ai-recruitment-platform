"""Small projections used by help-center HTML shell routes and sitemap."""

from common.seo import SITEMAP_URL_LIMIT

from ..models import KnowledgeCategory
from .public import (
    public_article_by_slugs,
    public_articles_queryset,
    public_categories_queryset,
)


def seo_knowledge_category_by_slug(slug):
    return (
        KnowledgeCategory.objects.filter(slug=slug, is_active=True)
        .only(
            'name',
            'slug',
            'description',
            'seo_title',
            'seo_description',
        )
        .first()
    )


def seo_knowledge_article_by_slugs(category_slug, article_slug):
    return public_article_by_slugs(category_slug, article_slug)


def knowledge_sitemap_rows():
    categories = (
        public_categories_queryset().filter(article_count__gt=0).values_list('slug', 'updated_at')
    )
    articles = public_articles_queryset().values_list(
        'category__slug',
        'slug',
        'published_revision__updated_at',
    )[:SITEMAP_URL_LIMIT]
    return categories, articles

"""Small projections used by help-center HTML shell routes."""

from ..models import KnowledgeCategory
from .public import public_article_by_slugs


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

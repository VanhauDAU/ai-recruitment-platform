"""Read-only projections for the public help center."""

from django.db.models import Count, Q

from common.db.search import search_q

from ..models import KnowledgeArticle, KnowledgeArticleRevision, KnowledgeCategory

PUBLIC_ARTICLE_FILTER = Q(
    lifecycle_state=KnowledgeArticle.LifecycleState.ACTIVE,
    category__is_active=True,
    published_revision__isnull=False,
    published_revision__status=KnowledgeArticleRevision.Status.APPROVED,
)


def public_categories_queryset():
    public_articles = Q(
        articles__lifecycle_state=KnowledgeArticle.LifecycleState.ACTIVE,
        articles__published_revision__isnull=False,
        articles__published_revision__status=KnowledgeArticleRevision.Status.APPROVED,
    )
    return (
        KnowledgeCategory.objects.filter(is_active=True)
        .annotate(article_count=Count('articles', filter=public_articles))
        .only('public_id', 'name', 'slug', 'description', 'order')
        .order_by('order', 'name', 'public_id')
    )


def public_articles_queryset(params=None):
    params = params or {}
    queryset = (
        KnowledgeArticle.objects.filter(PUBLIC_ARTICLE_FILTER)
        .select_related('category', 'published_revision')
        .only(
            'public_id',
            'slug',
            'article_type',
            'order',
            'first_published_at',
            'current_published_at',
            'category_id',
            'category__public_id',
            'category__name',
            'category__slug',
            'published_revision_id',
            'published_revision__title',
            'published_revision__body',
            'published_revision__body_plain_text',
            'published_revision__seo_title',
            'published_revision__seo_description',
            'published_revision__updated_at',
        )
    )
    if category := params.get('category'):
        queryset = queryset.filter(category__slug=category)
    if article_type := params.get('article_type'):
        queryset = queryset.filter(article_type=article_type)
    if query := params.get('q'):
        queryset = queryset.filter(
            search_q('published_revision__title', query)
            | search_q('published_revision__body_plain_text', query)
        )
    return queryset.order_by(
        'category__order',
        'order',
        'published_revision__title',
        'public_id',
    )


def public_article_by_slugs(category_slug, article_slug):
    return (
        public_articles_queryset()
        .filter(
            category__slug=category_slug,
            slug=article_slug,
        )
        .first()
    )


def public_article_navigation(article, *, related_limit=6):
    category_articles = public_articles_queryset({'category': article.category.slug})
    ordering = list(category_articles.values_list('public_id', flat=True))
    position = ordering.index(article.public_id)
    previous_id = ordering[position - 1] if position > 0 else None
    next_id = ordering[position + 1] if position + 1 < len(ordering) else None
    related_ids = [item for item in ordering if item != article.public_id][:related_limit]
    article_ids = [item for item in [previous_id, next_id, *related_ids] if item]
    by_public_id = {
        item.public_id: item
        for item in public_articles_queryset().filter(public_id__in=article_ids)
    }
    return {
        'previous_article': by_public_id.get(previous_id),
        'next_article': by_public_id.get(next_id),
        'related_articles': [by_public_id[item] for item in related_ids],
    }

from datetime import timedelta

from django.db.models import Count, OuterRef, Prefetch, Q, Subquery
from django.utils import timezone

from apps.accounts.models import AdminAccessAuditLog
from common.db.search import search_q

from ..models import (
    KnowledgeArticle,
    KnowledgeArticleRevision,
    KnowledgeCategory,
    KnowledgeMediaAsset,
)

ARTICLE_ORDERING = {
    'title': 'latest_revision_title',
    'category': 'category__name',
    'article_type': 'article_type',
    'revision_status': 'latest_revision_status',
    'lifecycle_state': 'lifecycle_state',
    'updated_at': 'updated_at',
    'review_due_at': 'review_due_at',
    'order': 'order',
}


def admin_categories_queryset():
    return (
        KnowledgeCategory.objects.annotate(
            article_count=Count('articles', distinct=True),
            public_article_count=Count(
                'articles',
                filter=Q(
                    articles__published_revision__isnull=False,
                    articles__lifecycle_state=KnowledgeArticle.LifecycleState.ACTIVE,
                ),
                distinct=True,
            ),
        )
        .all()
        .order_by('order', 'name', 'public_id')
    )


def _article_base_queryset():
    latest = KnowledgeArticleRevision.objects.filter(article=OuterRef('pk')).order_by('-number')
    return (
        KnowledgeArticle.objects.select_related('category', 'published_revision')
        .annotate(
            latest_revision_title=Subquery(latest.values('title')[:1]),
            latest_revision_status=Subquery(latest.values('status')[:1]),
            latest_revision_number=Subquery(latest.values('number')[:1]),
        )
        .prefetch_related(
            Prefetch(
                'revisions',
                queryset=KnowledgeArticleRevision.objects.select_related(
                    'created_by',
                    'submitted_by',
                    'reviewed_by',
                    'first_published_by',
                ).order_by('-number'),
                to_attr='admin_revisions',
            )
        )
    )


def _filter_admin_articles(queryset, params):
    if category := params.get('category'):
        queryset = queryset.filter(category__slug=category)
    if article_type := params.get('article_type'):
        queryset = queryset.filter(article_type=article_type)
    if lifecycle := params.get('lifecycle'):
        queryset = queryset.filter(lifecycle_state=lifecycle)
    if revision_status := params.get('revision_status'):
        queryset = queryset.filter(latest_revision_status=revision_status)
    if query := params.get('q'):
        queryset = queryset.filter(
            search_q('revisions__title', query) | search_q('revisions__body_plain_text', query)
        ).distinct()
    if params.get('review_due') == 'overdue':
        queryset = queryset.filter(review_due_at__lt=timezone.now())
    elif params.get('review_due') == 'due_soon':
        now = timezone.now()
        queryset = queryset.filter(
            review_due_at__gte=now,
            review_due_at__lte=now + timedelta(days=30),
        )

    return queryset


def admin_articles_queryset(params=None):
    params = params or {}
    queryset = _filter_admin_articles(_article_base_queryset(), params)

    ordering = params.get('ordering') or 'order'
    descending = ordering.startswith('-')
    field = ARTICLE_ORDERING[ordering.lstrip('-')]
    if descending:
        field = f'-{field}'
    return queryset.order_by(field, 'category__order', 'order', 'public_id')


def admin_article_summary(params=None):
    """Aggregate list KPIs across the complete filtered result set."""
    queryset = _filter_admin_articles(_article_base_queryset(), params or {}).order_by()
    return queryset.aggregate(
        total=Count('pk', distinct=True),
        published=Count('pk', filter=Q(published_revision__isnull=False), distinct=True),
        in_review=Count(
            'pk',
            filter=Q(latest_revision_status=KnowledgeArticleRevision.Status.IN_REVIEW),
            distinct=True,
        ),
        overdue=Count(
            'pk',
            filter=Q(review_due_at__lt=timezone.now()),
            distinct=True,
        ),
    )


def admin_article_detail_queryset():
    return _article_base_queryset()


def admin_media_queryset(query=''):
    queryset = KnowledgeMediaAsset.objects.select_related('uploaded_by').order_by(
        '-created_at', '-id'
    )
    if query:
        queryset = queryset.filter(search_q('original_name', query))
    return queryset


def article_audit_events(public_id):
    return AdminAccessAuditLog.objects.select_related('actor').filter(
        target_public_id=public_id,
        action__startswith='knowledge_',
    )

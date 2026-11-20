"""Article lifecycle and the draft -> publish revision workflow (ADR-0024)."""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from common.db.search import fold_accents

from ..models import KnowledgeArticle, KnowledgeArticleRevision, KnowledgeCategory
from .cache import invalidate_knowledge_public_cache
from .content import normalize_revision_content
from .editorial import KnowledgeConflict, assert_revision_token, record_editorial_action


def _lock_article(article):
    return (
        KnowledgeArticle.objects.select_for_update().select_related('category').get(pk=article.pk)
    )


def _slug_base(title):
    from django.utils.text import slugify

    return slugify(fold_accents(title))[:180].strip('-') or 'bai-viet'


def _available_slug(*, category, title, exclude_article=None):
    base = _slug_base(title)
    candidate = base
    suffix = 2
    queryset = KnowledgeArticle.objects.filter(category=category)
    if exclude_article:
        queryset = queryset.exclude(pk=exclude_article.pk)
    while queryset.filter(slug=candidate).exists():
        suffix_text = f'-{suffix}'
        candidate = f'{base[: 180 - len(suffix_text)].rstrip("-")}{suffix_text}'
        suffix += 1
    return candidate


@transaction.atomic
def create_article(
    *,
    actor,
    category,
    article_type,
    title,
    body,
    source_reference,
    order=0,
    seo_title='',
    seo_description='',
):
    normalized = normalize_revision_content(
        title=title,
        body=body,
        source_reference=source_reference,
    )
    article = KnowledgeArticle(
        category=category,
        slug=_available_slug(category=category, title=normalized['title']),
        article_type=article_type,
        order=order,
        created_by=actor,
    )
    article.full_clean()
    article.save()
    revision = KnowledgeArticleRevision(
        article=article,
        number=1,
        status=KnowledgeArticleRevision.Status.DRAFT,
        created_by=actor,
        seo_title=seo_title,
        seo_description=seo_description,
        **normalized,
    )
    revision.full_clean()
    revision.save()
    record_editorial_action(
        actor=actor,
        action='knowledge_article_create',
        target=article,
        payload={'revision': 1, 'article_type': article.article_type},
    )
    return article, revision


@transaction.atomic
def update_article(*, article, actor, expected_revision_token, **changes):
    article = _lock_article(article)
    assert_revision_token(article, expected_revision_token)
    locked_fields = {'category', 'slug', 'article_type'}
    changed_locked = {
        field
        for field in locked_fields
        if field in changes and changes[field] != getattr(article, field)
    }
    if article.first_published_at and changed_locked:
        raise ValidationError(
            {field: 'Trường này bị khóa sau lần xuất bản đầu tiên.' for field in changed_locked}
        )
    for field, value in changes.items():
        setattr(article, field, value)
    article.revision_token += 1
    article.full_clean()
    article.save()
    record_editorial_action(
        actor=actor,
        action='knowledge_article_update',
        target=article,
        payload={'fields': sorted(changes)},
    )
    if article.published_revision_id:
        invalidate_knowledge_public_cache()
    return article


@transaction.atomic
def create_revision(
    *,
    article,
    actor,
    expected_revision_token,
    title=None,
    body=None,
    source_reference=None,
    change_summary='',
    seo_title=None,
    seo_description=None,
):
    article = _lock_article(article)
    assert_revision_token(article, expected_revision_token)
    open_revision = article.revisions.filter(status=KnowledgeArticleRevision.Status.DRAFT).first()
    if open_revision:
        raise KnowledgeConflict(
            'knowledgebase_open_revision_exists',
            'Bài viết đã có một bản nháp đang mở.',
            open_revision=open_revision,
        )
    source = article.revisions.order_by('-number').first()
    normalized = normalize_revision_content(
        title=title if title is not None else source.title,
        body=body if body is not None else source.body,
        source_reference=(
            source_reference if source_reference is not None else source.source_reference
        ),
    )
    number = article.revisions.aggregate(value=Max('number'))['value'] + 1
    revision = KnowledgeArticleRevision(
        article=article,
        number=number,
        status=KnowledgeArticleRevision.Status.DRAFT,
        change_summary=str(change_summary or '').strip(),
        seo_title=source.seo_title if seo_title is None else seo_title,
        seo_description=source.seo_description if seo_description is None else seo_description,
        created_by=actor,
        **normalized,
    )
    revision.full_clean()
    revision.save()
    article.revision_token += 1
    article.save(update_fields=['revision_token', 'updated_at'])
    record_editorial_action(
        actor=actor,
        action='knowledge_revision_create',
        target=article,
        payload={'revision': revision.number},
    )
    return article, revision


@transaction.atomic
def update_draft_revision(
    *,
    article,
    revision_number,
    actor,
    expected_revision_token,
    **changes,
):
    article = _lock_article(article)
    assert_revision_token(article, expected_revision_token)
    revision = article.revisions.select_for_update().filter(number=revision_number).first()
    if not revision or revision.status != KnowledgeArticleRevision.Status.DRAFT:
        raise KnowledgeConflict(
            'knowledgebase_revision_not_editable',
            'Chỉ bản nháp mới được chỉnh sửa.',
        )
    normalized = normalize_revision_content(
        title=changes.pop('title', revision.title),
        body=changes.pop('body', revision.body),
        source_reference=changes.pop('source_reference', revision.source_reference),
    )
    for field in ('seo_title', 'seo_description', 'change_summary'):
        if field in changes:
            setattr(revision, field, str(changes[field] or '').strip())
    for field, value in normalized.items():
        setattr(revision, field, value)
    revision.full_clean()
    revision.save()
    article.revision_token += 1
    article.save(update_fields=['revision_token', 'updated_at'])
    record_editorial_action(
        actor=actor,
        action='knowledge_revision_update',
        target=article,
        payload={'revision': revision.number},
    )
    return article, revision


@transaction.atomic
def discard_draft_revision(*, article, revision_number, actor, expected_revision_token):
    """Bỏ bản nháp của bài đã công khai; bản nháp chưa từng public nên xóa hẳn."""
    article = _lock_article(article)
    assert_revision_token(article, expected_revision_token)
    revision = article.revisions.select_for_update().filter(number=revision_number).first()
    if not revision or revision.status != KnowledgeArticleRevision.Status.DRAFT:
        raise KnowledgeConflict(
            'knowledgebase_revision_not_editable',
            'Chỉ bản nháp mới có thể hủy.',
        )
    if not article.published_revision_id:
        raise KnowledgeConflict(
            'knowledgebase_draft_is_only_revision',
            'Bài chưa từng xuất bản; hãy lưu trữ bài thay vì hủy bản nháp duy nhất.',
        )
    revision.delete()
    article.revision_token += 1
    article.save(update_fields=['revision_token', 'updated_at'])
    record_editorial_action(
        actor=actor,
        action='knowledge_revision_discard',
        target=article,
        payload={'revision': revision_number},
    )
    return article


@transaction.atomic
def publish_revision(
    *,
    article,
    revision_number,
    actor,
    expected_revision_token,
    review_due_at=None,
):
    article = _lock_article(article)
    assert_revision_token(article, expected_revision_token)
    if article.lifecycle_state == KnowledgeArticle.LifecycleState.ARCHIVED:
        raise KnowledgeConflict(
            'knowledgebase_article_archived',
            'Khôi phục bài viết trước khi xuất bản revision.',
        )
    revision = article.revisions.select_for_update().filter(number=revision_number).first()
    if not revision:
        raise KnowledgeConflict(
            'knowledgebase_revision_not_found',
            'Revision không thuộc bài viết này.',
        )
    if revision.status == KnowledgeArticleRevision.Status.DRAFT:
        if article.first_published_at and not revision.change_summary.strip():
            raise ValidationError(
                {'change_summary': 'Bắt buộc mô tả thay đổi của bài đã xuất bản.'}
            )
    elif revision.pk == article.published_revision_id:
        raise KnowledgeConflict(
            'knowledgebase_revision_already_public',
            'Revision này đang được công khai.',
        )
    now = timezone.now()
    maximum_due_at = now + timedelta(days=article.category.review_interval_days)
    if review_due_at and review_due_at > maximum_due_at:
        raise ValidationError(
            {'review_due_at': 'Hạn xác minh không được muộn hơn chu kỳ category.'}
        )
    rollback = revision.status == KnowledgeArticleRevision.Status.PUBLISHED
    if not rollback:
        revision.status = KnowledgeArticleRevision.Status.PUBLISHED
        revision.first_published_at = now
        revision.first_published_by = actor
        revision.save(
            update_fields=['status', 'first_published_at', 'first_published_by', 'updated_at']
        )
    if article.first_published_at is None:
        article.first_published_at = now
    article.published_revision = revision
    article.current_published_at = now
    article.review_due_at = review_due_at or maximum_due_at
    article.revision_token += 1
    article.save()
    record_editorial_action(
        actor=actor,
        action='knowledge_article_publish',
        target=article,
        payload={'revision': revision.number, 'rollback': rollback},
    )
    invalidate_knowledge_public_cache()
    return article


@transaction.atomic
def archive_article(*, article, actor, expected_revision_token):
    article = _lock_article(article)
    assert_revision_token(article, expected_revision_token)
    if article.lifecycle_state == KnowledgeArticle.LifecycleState.ARCHIVED:
        raise KnowledgeConflict('knowledgebase_article_archived', 'Bài viết đã được lưu trữ.')
    article.lifecycle_state = KnowledgeArticle.LifecycleState.ARCHIVED
    article.archived_by = actor
    article.archived_at = timezone.now()
    article.revision_token += 1
    article.save()
    record_editorial_action(actor=actor, action='knowledge_article_archive', target=article)
    invalidate_knowledge_public_cache()
    return article


@transaction.atomic
def restore_article(*, article, actor, expected_revision_token):
    article = _lock_article(article)
    assert_revision_token(article, expected_revision_token)
    if article.lifecycle_state != KnowledgeArticle.LifecycleState.ARCHIVED:
        raise KnowledgeConflict('knowledgebase_article_active', 'Bài viết đang hoạt động.')
    article.lifecycle_state = KnowledgeArticle.LifecycleState.ACTIVE
    article.archived_by = None
    article.archived_at = None
    article.revision_token += 1
    article.save()
    record_editorial_action(actor=actor, action='knowledge_article_restore', target=article)
    invalidate_knowledge_public_cache()
    return article


@transaction.atomic
def reorder_articles(*, category, ordered_public_ids, actor):
    category = KnowledgeCategory.objects.select_for_update().get(pk=category.pk)
    articles = list(
        KnowledgeArticle.objects.select_for_update().filter(category=category).order_by('id')
    )
    by_public_id = {item.public_id: item for item in articles}
    if len(ordered_public_ids) != len(set(ordered_public_ids)) or set(ordered_public_ids) != set(
        by_public_id
    ):
        raise ValidationError(
            {'public_ids': 'Danh sách phải chứa đúng toàn bộ bài trong category một lần.'}
        )
    for order, public_id in enumerate(ordered_public_ids, start=1):
        article = by_public_id[public_id]
        article.order = order
        article.revision_token += 1
    KnowledgeArticle.objects.bulk_update(articles, ['order', 'revision_token', 'updated_at'])
    record_editorial_action(
        actor=actor,
        action='knowledge_article_reorder',
        target=category,
        payload={'count': len(articles)},
    )
    invalidate_knowledge_public_cache()
    return articles

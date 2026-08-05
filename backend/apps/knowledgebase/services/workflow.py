from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.accounts.services import record_admin_action
from common.db.search import fold_accents

from ..models import KnowledgeArticle, KnowledgeArticleRevision, KnowledgeCategory
from .content import normalize_revision_content


class KnowledgeConflict(Exception):
    def __init__(self, code, detail, *, current_revision_token=None, open_revision=None):
        self.code = code
        self.detail = detail
        self.current_revision_token = current_revision_token
        self.open_revision = open_revision
        super().__init__(detail)


def _record(*, actor, action, target, payload=None):
    return record_admin_action(
        actor=actor,
        action=action,
        target_type=target.__class__.__name__,
        target_public_id=target.public_id,
        payload=payload or {},
    )


def _assert_token(resource, expected):
    if expected is None or resource.revision_token != expected:
        raise KnowledgeConflict(
            'knowledgebase_revision_stale',
            'Nội dung đã thay đổi trên máy chủ. Hãy đối chiếu trước khi tiếp tục.',
            current_revision_token=resource.revision_token,
        )


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
def create_category(*, actor, **data):
    category = KnowledgeCategory(**data)
    category.full_clean()
    category.save()
    _record(actor=actor, action='knowledge_category_create', target=category)
    return category


@transaction.atomic
def update_category(*, category, actor, expected_revision_token, **changes):
    category = KnowledgeCategory.objects.select_for_update().get(pk=category.pk)
    _assert_token(category, expected_revision_token)
    if 'slug' in changes and changes['slug'] != category.slug:
        if category.articles.filter(first_published_at__isnull=False).exists():
            raise ValidationError({'slug': 'Slug bị khóa vì chuyên mục đã có bài từng xuất bản.'})
    for field, value in changes.items():
        setattr(category, field, value)
    category.revision_token += 1
    category.full_clean()
    category.save()
    _record(
        actor=actor,
        action='knowledge_category_update',
        target=category,
        payload={'fields': sorted(changes)},
    )
    return category


@transaction.atomic
def reorder_categories(*, categories, ordered_public_ids, actor):
    locked = list(
        KnowledgeCategory.objects.select_for_update()
        .filter(pk__in=[item.pk for item in categories])
        .order_by('id')
    )
    by_public_id = {item.public_id: item for item in locked}
    if len(ordered_public_ids) != len(set(ordered_public_ids)) or set(ordered_public_ids) != set(
        by_public_id
    ):
        raise ValidationError(
            {'public_ids': 'Danh sách phải chứa đúng toàn bộ chuyên mục một lần.'}
        )
    for order, public_id in enumerate(ordered_public_ids, start=1):
        category = by_public_id[public_id]
        category.order = order
        category.revision_token += 1
    KnowledgeCategory.objects.bulk_update(locked, ['order', 'revision_token', 'updated_at'])
    _record(
        actor=actor,
        action='knowledge_category_reorder',
        target=locked[0],
        payload={'count': len(locked)},
    )
    return locked


@transaction.atomic
def set_category_active(*, category, actor, is_active, expected_revision_token):
    category = KnowledgeCategory.objects.select_for_update().get(pk=category.pk)
    _assert_token(category, expected_revision_token)
    category.is_active = is_active
    category.revision_token += 1
    category.save(update_fields=['is_active', 'revision_token', 'updated_at'])
    _record(
        actor=actor,
        action='knowledge_category_activate' if is_active else 'knowledge_category_deactivate',
        target=category,
        payload={
            'public_article_count': category.articles.filter(
                published_revision__isnull=False
            ).count()
        },
    )
    return category


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
    _record(
        actor=actor,
        action='knowledge_article_create',
        target=article,
        payload={'revision': 1, 'article_type': article.article_type},
    )
    return article, revision


@transaction.atomic
def update_article(*, article, actor, expected_revision_token, **changes):
    article = _lock_article(article)
    _assert_token(article, expected_revision_token)
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
    _record(
        actor=actor,
        action='knowledge_article_update',
        target=article,
        payload={'fields': sorted(changes)},
    )
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
    _assert_token(article, expected_revision_token)
    open_revision = article.revisions.filter(
        status__in=[
            KnowledgeArticleRevision.Status.DRAFT,
            KnowledgeArticleRevision.Status.IN_REVIEW,
        ]
    ).first()
    if open_revision:
        raise KnowledgeConflict(
            'knowledgebase_open_revision_exists',
            'Bài viết đã có một revision đang mở.',
            open_revision=open_revision,
        )
    source = article.published_revision or article.revisions.order_by('-number').first()
    normalized = normalize_revision_content(
        title=title if title is not None else source.title,
        body=body if body is not None else source.body,
        source_reference=(
            source_reference if source_reference is not None else source.source_reference
        ),
    )
    if article.first_published_at and not str(change_summary or '').strip():
        raise ValidationError({'change_summary': 'Bắt buộc mô tả thay đổi của bài đã xuất bản.'})
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
    _record(
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
    _assert_token(article, expected_revision_token)
    revision = article.revisions.select_for_update().filter(number=revision_number).first()
    if not revision or revision.status != KnowledgeArticleRevision.Status.DRAFT:
        raise KnowledgeConflict(
            'knowledgebase_revision_not_editable',
            'Chỉ revision nháp mới được chỉnh sửa.',
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
    _record(
        actor=actor,
        action='knowledge_revision_update',
        target=article,
        payload={'revision': revision.number},
    )
    return article, revision


def _transition_revision(
    *,
    article,
    revision_number,
    actor,
    expected_revision_token,
    from_status,
    to_status,
    review_note='',
):
    article = _lock_article(article)
    _assert_token(article, expected_revision_token)
    revision = article.revisions.select_for_update().filter(number=revision_number).first()
    if not revision or revision.status != from_status:
        raise KnowledgeConflict(
            'knowledgebase_invalid_transition',
            'Revision không ở trạng thái phù hợp cho thao tác này.',
        )
    if to_status == KnowledgeArticleRevision.Status.REJECTED and not str(review_note).strip():
        raise ValidationError({'review_note': 'Nhập lý do từ chối.'})
    now = timezone.now()
    revision.status = to_status
    if to_status == KnowledgeArticleRevision.Status.IN_REVIEW:
        revision.submitted_by = actor
        revision.submitted_at = now
    else:
        revision.reviewed_by = actor
        revision.reviewed_at = now
        revision.review_note = str(review_note or '').strip()
    revision.save()
    article.revision_token += 1
    article.save(update_fields=['revision_token', 'updated_at'])
    _record(
        actor=actor,
        action=f'knowledge_revision_{to_status.lower()}',
        target=article,
        payload={'revision': revision.number},
    )
    return article, revision


@transaction.atomic
def submit_revision(**kwargs):
    return _transition_revision(
        from_status=KnowledgeArticleRevision.Status.DRAFT,
        to_status=KnowledgeArticleRevision.Status.IN_REVIEW,
        **kwargs,
    )


@transaction.atomic
def approve_revision(**kwargs):
    return _transition_revision(
        from_status=KnowledgeArticleRevision.Status.IN_REVIEW,
        to_status=KnowledgeArticleRevision.Status.APPROVED,
        **kwargs,
    )


@transaction.atomic
def reject_revision(**kwargs):
    return _transition_revision(
        from_status=KnowledgeArticleRevision.Status.IN_REVIEW,
        to_status=KnowledgeArticleRevision.Status.REJECTED,
        **kwargs,
    )


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
    _assert_token(article, expected_revision_token)
    if article.lifecycle_state == KnowledgeArticle.LifecycleState.ARCHIVED:
        raise KnowledgeConflict(
            'knowledgebase_article_archived',
            'Khôi phục bài viết trước khi xuất bản revision.',
        )
    revision = article.revisions.select_for_update().filter(number=revision_number).first()
    if not revision or revision.status != KnowledgeArticleRevision.Status.APPROVED:
        raise KnowledgeConflict(
            'knowledgebase_revision_not_approved',
            'Chỉ revision đã duyệt của chính bài viết mới được xuất bản.',
        )
    now = timezone.now()
    maximum_due_at = now + timedelta(days=article.category.review_interval_days)
    if review_due_at and review_due_at > maximum_due_at:
        raise ValidationError(
            {'review_due_at': 'Hạn xác minh không được muộn hơn chu kỳ category.'}
        )
    if revision.first_published_at is None:
        revision.first_published_at = now
        revision.first_published_by = actor
        revision.save(update_fields=['first_published_at', 'first_published_by'])
    if article.first_published_at is None:
        article.first_published_at = now
    article.published_revision = revision
    article.current_published_at = now
    article.review_due_at = review_due_at or maximum_due_at
    article.revision_token += 1
    article.save()
    _record(
        actor=actor,
        action='knowledge_article_publish',
        target=article,
        payload={'revision': revision.number},
    )
    return article


@transaction.atomic
def archive_article(*, article, actor, expected_revision_token):
    article = _lock_article(article)
    _assert_token(article, expected_revision_token)
    if article.lifecycle_state == KnowledgeArticle.LifecycleState.ARCHIVED:
        raise KnowledgeConflict('knowledgebase_article_archived', 'Bài viết đã được lưu trữ.')
    article.lifecycle_state = KnowledgeArticle.LifecycleState.ARCHIVED
    article.archived_by = actor
    article.archived_at = timezone.now()
    article.revision_token += 1
    article.save()
    _record(actor=actor, action='knowledge_article_archive', target=article)
    return article


@transaction.atomic
def restore_article(*, article, actor, expected_revision_token):
    article = _lock_article(article)
    _assert_token(article, expected_revision_token)
    if article.lifecycle_state != KnowledgeArticle.LifecycleState.ARCHIVED:
        raise KnowledgeConflict('knowledgebase_article_active', 'Bài viết đang hoạt động.')
    article.lifecycle_state = KnowledgeArticle.LifecycleState.ACTIVE
    article.archived_by = None
    article.archived_at = None
    article.revision_token += 1
    article.save()
    _record(actor=actor, action='knowledge_article_restore', target=article)
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
    _record(
        actor=actor,
        action='knowledge_article_reorder',
        target=category,
        payload={'count': len(articles)},
    )
    return articles

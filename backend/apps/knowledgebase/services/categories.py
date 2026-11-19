"""Knowledgebase category maintenance."""

from django.core.exceptions import ValidationError
from django.db import transaction

from ..models import KnowledgeCategory
from .cache import invalidate_knowledge_public_cache
from .editorial import assert_revision_token, record_editorial_action


@transaction.atomic
def create_category(*, actor, **data):
    category = KnowledgeCategory(**data)
    category.full_clean()
    category.save()
    record_editorial_action(actor=actor, action='knowledge_category_create', target=category)
    invalidate_knowledge_public_cache()
    return category


@transaction.atomic
def update_category(*, category, actor, expected_revision_token, **changes):
    category = KnowledgeCategory.objects.select_for_update().get(pk=category.pk)
    assert_revision_token(category, expected_revision_token)
    if 'slug' in changes and changes['slug'] != category.slug:
        if category.articles.filter(first_published_at__isnull=False).exists():
            raise ValidationError({'slug': 'Slug bị khóa vì chuyên mục đã có bài từng xuất bản.'})
    for field, value in changes.items():
        setattr(category, field, value)
    category.revision_token += 1
    category.full_clean()
    category.save()
    record_editorial_action(
        actor=actor,
        action='knowledge_category_update',
        target=category,
        payload={'fields': sorted(changes)},
    )
    invalidate_knowledge_public_cache()
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
    record_editorial_action(
        actor=actor,
        action='knowledge_category_reorder',
        target=locked[0],
        payload={'count': len(locked)},
    )
    invalidate_knowledge_public_cache()
    return locked


@transaction.atomic
def set_category_active(*, category, actor, is_active, expected_revision_token):
    category = KnowledgeCategory.objects.select_for_update().get(pk=category.pk)
    assert_revision_token(category, expected_revision_token)
    category.is_active = is_active
    category.revision_token += 1
    category.save(update_fields=['is_active', 'revision_token', 'updated_at'])
    record_editorial_action(
        actor=actor,
        action='knowledge_category_activate' if is_active else 'knowledge_category_deactivate',
        target=category,
        payload={
            'public_article_count': category.articles.filter(
                published_revision__isnull=False
            ).count()
        },
    )
    invalidate_knowledge_public_cache()
    return category

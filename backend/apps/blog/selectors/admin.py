from django.db.models import Case, CharField, Count, F, IntegerField, TextField, Value, When
from django.db.models.functions import Coalesce, Length, NullIf, Trim

from common.db.search import search_q

from ..models import BlogMediaAsset, PinnedPost, Post, PostCategory, Tag


def _working_copy_text(field):
    return Case(
        When(working_copy__isnull=False, then=F(f'working_copy__{field}')),
        default=F(field),
        output_field=TextField(),
    )


def _with_completeness_sort(queryset):
    text_fields = (
        'title',
        'summary',
        'content',
        'thumbnail_url',
        'seo_title',
        'seo_description',
    )
    length_annotations = {
        f'_completion_{field}_length': Length(Trim(_working_copy_text(field)))
        for field in text_fields
    }
    queryset = queryset.annotate(
        **length_annotations,
        _completion_related_job_id=Case(
            When(
                working_copy__isnull=False,
                then=F('working_copy__related_job_category_id'),
            ),
            default=F('related_job_category_id'),
            output_field=IntegerField(),
        ),
    )
    score = Value(0, output_field=IntegerField())
    for field in text_fields:
        score += Case(
            When(**{f'_completion_{field}_length__gt': 0}, then=Value(1)),
            default=Value(0),
            output_field=IntegerField(),
        )
    score += Case(
        When(_completion_related_job_id__isnull=False, then=Value(1)),
        default=Value(0),
        output_field=IntegerField(),
    )
    return queryset.annotate(_completeness_sort=score)


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

    ordering = params.get('ordering') or '-updated_at'
    descending = ordering.startswith('-')
    ordering_key = ordering.removeprefix('-')
    ordering_fields = {
        'title': 'title',
        'category': 'category__name',
        'view_count': 'view_count',
        'published_at': 'published_at',
        'updated_at': 'updated_at',
    }
    if ordering_key == 'author':
        queryset = queryset.annotate(
            _author_sort=Coalesce(
                NullIf('author__full_name', Value('')),
                'author__email',
                Value(''),
                output_field=CharField(),
            )
        )
        ordering_fields['author'] = '_author_sort'
    elif ordering_key == 'editorial_state':
        queryset = queryset.annotate(
            _editorial_state_sort=Case(
                When(
                    status=Post.Status.PUBLISHED,
                    working_copy__status='pending',
                    then=Value(4),
                ),
                When(
                    status=Post.Status.PUBLISHED,
                    working_copy__status='draft',
                    then=Value(3),
                ),
                When(status=Post.Status.PUBLISHED, then=Value(2)),
                When(status=Post.Status.PENDING, then=Value(1)),
                When(status=Post.Status.ARCHIVED, then=Value(5)),
                default=Value(0),
                output_field=IntegerField(),
            )
        )
        ordering_fields['editorial_state'] = '_editorial_state_sort'
    elif ordering_key == 'completeness':
        queryset = _with_completeness_sort(queryset)
        ordering_fields['completeness'] = '_completeness_sort'

    field = ordering_fields.get(ordering_key)
    if not field:
        return queryset.order_by('-updated_at', '-id')
    prefix = '-' if descending else ''
    return queryset.order_by(f'{prefix}{field}', f'{prefix}id')


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

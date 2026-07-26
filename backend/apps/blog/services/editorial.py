from http import HTTPStatus

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from apps.accounts.services import record_admin_action

from ..models import Post, PostStatusHistory, PostWorkingCopy
from .content import blog_html_plain_text, sanitize_blog_html

EDITABLE_FIELDS = (
    'title',
    'category',
    'summary',
    'thumbnail_url',
    'content',
    'related_job_category',
    'seo_title',
    'seo_description',
)


class BlogResourceChanged(APIException):
    status_code = HTTPStatus.CONFLICT
    default_code = 'blog_resource_changed'

    def __init__(self, current_revision):
        super().__init__(
            {
                'code': 'blog_resource_changed',
                'message': 'Bài viết đã thay đổi ở một phiên khác. Vui lòng tải lại trước khi lưu.',
                'current_revision': current_revision,
            }
        )


def _state(post):
    copy = getattr(post, 'working_copy', None)
    if post.status == Post.Status.PUBLISHED and copy:
        return f'published_with_{copy.status}'
    return post.status


def _history(post, *, actor, action, from_status, to_status, note=''):
    PostStatusHistory.objects.create(
        post=post,
        actor=actor,
        action=action,
        from_status=from_status,
        to_status=to_status,
        note=(note or '').strip(),
    )
    record_admin_action(
        actor=actor,
        action=f'blog_{action}',
        target_type='blog_post',
        target_public_id=post.public_id,
        payload={'from_status': from_status, 'to_status': to_status, 'note': (note or '').strip()},
    )


def _validate_publishable(source, *, category):
    errors = {}
    if not (source.title or '').strip():
        errors['title'] = 'Nhập tiêu đề bài viết.'
    if not (source.summary or '').strip():
        errors['summary'] = 'Nhập sapo bài viết.'
    clean = sanitize_blog_html(source.content)
    if not blog_html_plain_text(clean):
        errors['content'] = 'Nhập nội dung bài viết.'
    if not category or not category.is_active:
        errors['category_public_id'] = 'Chọn một danh mục đang hoạt động.'
    if errors:
        raise ValidationError(errors)


def _copy_from_post(post, actor):
    copy, created = PostWorkingCopy.objects.get_or_create(
        post=post,
        defaults={
            **{field: getattr(post, field) for field in EDITABLE_FIELDS},
            'created_by': actor,
            'updated_by': actor,
        },
    )
    if created:
        copy.tags.set(post.tags.all())
        _history(
            post,
            actor=actor,
            action='start_revision',
            from_status=Post.Status.PUBLISHED,
            to_status='published_with_draft',
        )
    return copy


@transaction.atomic
def create_post(*, actor, validated_data, tags):
    content = sanitize_blog_html(validated_data.pop('content', ''))
    post = Post.objects.create(
        **validated_data,
        content=content,
        author=actor,
        status=Post.Status.DRAFT,
    )
    post.tags.set(tags)
    _history(post, actor=actor, action='create', from_status='', to_status=Post.Status.DRAFT)
    return post


@transaction.atomic
def save_post_draft(*, post, actor, validated_data, tags=None, base_revision):
    post = Post.objects.select_for_update().select_related('category').get(pk=post.pk)
    if post.status == Post.Status.ARCHIVED:
        raise ValidationError({'detail': 'Khôi phục bài về nháp trước khi sửa.'})

    target = _copy_from_post(post, actor) if post.status == Post.Status.PUBLISHED else post
    if target.edit_revision != base_revision:
        raise BlogResourceChanged(target.edit_revision)
    if isinstance(target, PostWorkingCopy) and 'slug' in validated_data:
        raise ValidationError({'slug': 'Slug được khóa sau lần xuất bản đầu tiên.'})

    for field, value in validated_data.items():
        if field == 'content':
            value = sanitize_blog_html(value)
        setattr(target, field, value)
    target.edit_revision += 1
    update_fields = [*validated_data.keys(), 'edit_revision', 'updated_at']
    if isinstance(target, PostWorkingCopy):
        target.updated_by = actor
        update_fields.append('updated_by')
    target.save(update_fields=update_fields)
    if tags is not None:
        target.tags.set(tags)
    return post


@transaction.atomic
def submit_post(*, post, actor):
    post = Post.objects.select_for_update().select_related('category').get(pk=post.pk)
    source = getattr(post, 'working_copy', None) if post.status == Post.Status.PUBLISHED else post
    if source is None or source.status not in {Post.Status.DRAFT, Post.Status.PENDING}:
        raise ValidationError({'detail': 'Chỉ bài nháp hoặc bài đang chờ duyệt mới có thể gửi duyệt.'})
    _validate_publishable(source, category=source.category)
    before = _state(post)
    resubmitting = source.status == Post.Status.PENDING
    source.status = Post.Status.PENDING
    source.submitted_at = timezone.now()
    source.edit_revision += 1
    source.save(update_fields=['status', 'submitted_at', 'edit_revision', 'updated_at'])
    _history(
        post,
        actor=actor,
        action='resubmit' if resubmitting else 'submit',
        from_status=before,
        to_status=_state(post),
    )
    return post


@transaction.atomic
def return_post(*, post, actor, note):
    post = Post.objects.select_for_update().get(pk=post.pk)
    source = getattr(post, 'working_copy', None) if post.status == Post.Status.PUBLISHED else post
    if source is None or source.status != Post.Status.PENDING:
        raise ValidationError({'detail': 'Bài không ở trạng thái chờ duyệt.'})
    before = _state(post)
    source.status = Post.Status.DRAFT
    source.submitted_at = None
    source.edit_revision += 1
    source.save(update_fields=['status', 'submitted_at', 'edit_revision', 'updated_at'])
    _history(
        post, actor=actor, action='return', from_status=before, to_status=_state(post), note=note
    )
    return post


@transaction.atomic
def publish_post(*, post, actor):
    post = Post.objects.select_for_update().select_related('category').get(pk=post.pk)
    copy = getattr(post, 'working_copy', None)
    source = copy if post.status == Post.Status.PUBLISHED else post
    if source is None or source.status != Post.Status.PENDING:
        raise ValidationError({'detail': 'Chỉ bài đang chờ duyệt mới có thể xuất bản.'})
    _validate_publishable(source, category=source.category)
    before = _state(post)
    if copy:
        for field in EDITABLE_FIELDS:
            setattr(post, field, getattr(copy, field))
        post.status = Post.Status.PUBLISHED
        post.edit_revision += 1
        post.save(update_fields=[*EDITABLE_FIELDS, 'status', 'edit_revision', 'updated_at'])
        post.tags.set(copy.tags.all())
        copy.delete()
    else:
        post.status = Post.Status.PUBLISHED
        post.published_at = post.published_at or timezone.now()
        post.edit_revision += 1
        post.save(update_fields=['status', 'published_at', 'edit_revision', 'updated_at'])
    _history(
        post, actor=actor, action='publish', from_status=before, to_status=Post.Status.PUBLISHED
    )
    return post


@transaction.atomic
def archive_post(*, post, actor, note):
    post = Post.objects.select_for_update().get(pk=post.pk)
    before = _state(post)
    copy = getattr(post, 'working_copy', None)
    if copy:
        copy.delete()
    post.status = Post.Status.ARCHIVED
    post.edit_revision += 1
    post.save(update_fields=['status', 'edit_revision', 'updated_at'])
    _history(
        post,
        actor=actor,
        action='archive',
        from_status=before,
        to_status=Post.Status.ARCHIVED,
        note=note,
    )
    return post


@transaction.atomic
def restore_post(*, post, actor):
    post = Post.objects.select_for_update().get(pk=post.pk)
    if post.status != Post.Status.ARCHIVED:
        raise ValidationError({'detail': 'Chỉ bài đã gỡ mới có thể khôi phục.'})
    post.status = Post.Status.DRAFT
    post.submitted_at = None
    post.edit_revision += 1
    post.save(update_fields=['status', 'submitted_at', 'edit_revision', 'updated_at'])
    _history(
        post,
        actor=actor,
        action='restore',
        from_status=Post.Status.ARCHIVED,
        to_status=Post.Status.DRAFT,
    )
    return post


@transaction.atomic
def discard_draft(*, post, actor):
    post = Post.objects.select_for_update().get(pk=post.pk)
    copy = getattr(post, 'working_copy', None)
    if copy:
        if copy.status != PostWorkingCopy.Status.DRAFT:
            raise ValidationError({'detail': 'Không thể hủy bản sửa đang chờ duyệt.'})
        before = _state(post)
        copy.delete()
        _history(
            post,
            actor=actor,
            action='discard_revision',
            from_status=before,
            to_status=Post.Status.PUBLISHED,
        )
        return post
    if post.status != Post.Status.DRAFT:
        raise ValidationError({'detail': 'Chỉ bản nháp mới có thể hủy.'})
    post.status = Post.Status.ARCHIVED
    post.edit_revision += 1
    post.save(update_fields=['status', 'edit_revision', 'updated_at'])
    _history(
        post,
        actor=actor,
        action='discard',
        from_status=Post.Status.DRAFT,
        to_status=Post.Status.ARCHIVED,
    )
    return post

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.accounts.services import record_admin_action

from ..models import Tag


@transaction.atomic
def merge_tags(*, source, target, actor):
    if source.pk == target.pk:
        raise ValidationError({'target_public_id': 'Chọn một thẻ khác để gộp.'})

    locked = {
        tag.pk: tag for tag in Tag.objects.select_for_update().filter(pk__in=[source.pk, target.pk])
    }
    source = locked.get(source.pk)
    target = locked.get(target.pk)
    if not source or not target:
        raise ValidationError({'detail': 'Thẻ không còn tồn tại. Hãy tải lại danh sách.'})

    posts = list(source.posts.all())
    working_copies = list(source.working_copies.all())
    target.posts.add(*posts)
    target.working_copies.add(*working_copies)
    source_public_id = source.public_id
    source_name = source.name
    source.delete()
    record_admin_action(
        actor=actor,
        action='blog_merge_tag',
        target_type='blog_tag',
        target_public_id=target.public_id,
        payload={
            'source_public_id': source_public_id,
            'source_name': source_name,
            'post_count': len(posts),
            'working_copy_count': len(working_copies),
        },
    )
    return target

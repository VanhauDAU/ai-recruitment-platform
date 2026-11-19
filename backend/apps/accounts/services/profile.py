"""Account-owner profile edits: name/phone and avatar."""

from common.storage.media import delete_local_media_url, save_image_upload

from .admin_audit import record_admin_self_action

# Ảnh đại diện đã được cắt vuông phía client; giới hạn này chặn file gửi thẳng
# qua API quá lớn (ảnh vẫn được hiển thị tối đa vài trăm px).
AVATAR_MAX_DIMENSIONS = (1024, 1024)


def update_own_profile(user, changes):
    for field, value in changes.items():
        setattr(user, field, value)
    user.save()
    record_admin_self_action(user, 'self_profile_update', {'fields': sorted(changes)})
    return user


def replace_avatar(user, upload):
    old_url = user.avatar_url
    saved = save_image_upload(
        upload,
        f'users/avatars/{user.public_id}',
        max_dimensions=AVATAR_MAX_DIMENSIONS,
    )
    # Database chỉ lưu storage key; serializer sẽ resolve URL theo domain/CDN
    # hiện tại khi trả API.
    user.avatar_url = saved['path']
    user.save(update_fields=['avatar_url', 'updated_at'])
    delete_local_media_url(old_url)
    return user


def remove_avatar(user):
    old_url = user.avatar_url
    if old_url:
        user.avatar_url = ''
        user.save(update_fields=['avatar_url', 'updated_at'])
        delete_local_media_url(old_url)
    return user

"""Admin authoring and lifecycle of announcements, guarded by the revision token."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.accounts.services import record_admin_action
from common.errors import DomainError

from ..models import (
    Announcement,
    AnnouncementRevision,
)
from .announcement_content import normalize_revision_data


class StaleAnnouncementRevision(DomainError):
    status_code = 409
    code = 'announcement_revision_stale'

    def __init__(self, current_revision_token):
        self.current_revision_token = current_revision_token
        super().__init__('Announcement revision token is stale.')

    def payload(self):
        return {
            'code': self.code,
            'detail': 'Thông báo đã được thay đổi. Hãy tải lại và kiểm tra trước khi tiếp tục.',
            'current_revision_token': self.current_revision_token,
        }


REVISION_COPY_FIELDS = (
    'message_vi',
    'message_en',
    'badge_vi',
    'badge_en',
    'icon',
    'cta_label_vi',
    'cta_label_en',
    'cta_url',
    'kind',
    'surfaces',
    'auth_audiences',
    'roles',
    'include_path_prefixes',
    'exclude_path_prefixes',
    'starts_at',
    'ends_at',
    'priority',
    'animation',
    'display_seconds',
    'dismiss_mode',
    'snooze_seconds',
    'theme_mode',
    'theme_preset',
    'color_accent',
    'color_bg_from',
    'color_bg_to',
    'color_fg',
    'background_image',
    'background_fit',
    'background_position',
    'background_overlay',
)


def _assert_revision_token(announcement, expected_revision_token):
    if announcement.revision_token != expected_revision_token:
        raise StaleAnnouncementRevision(announcement.revision_token)


def lock_announcement(announcement):
    return Announcement.objects.select_for_update().get(pk=announcement.pk)


def _record_action(*, actor, action, announcement, payload=None):
    return record_admin_action(
        actor=actor,
        action=action,
        target_type='announcement',
        target_public_id=announcement.public_id,
        payload=payload or {},
    )


def _create_revision(*, announcement, actor, number, revision_data):
    normalized = normalize_revision_data(revision_data)
    revision = AnnouncementRevision(
        announcement=announcement,
        number=number,
        created_by=actor,
        **normalized,
    )
    revision.full_clean()
    revision.save()
    return revision


@transaction.atomic
def create_announcement(*, actor, internal_name, revision_data):
    announcement = Announcement(
        internal_name=internal_name.strip(),
        created_by=actor,
    )
    announcement.full_clean()
    announcement.save()
    revision = _create_revision(
        announcement=announcement,
        actor=actor,
        number=1,
        revision_data=revision_data,
    )
    _record_action(
        actor=actor,
        action='announcement_create',
        announcement=announcement,
        payload={'revision': revision.number},
    )
    return announcement


@transaction.atomic
def rename_announcement(*, announcement, actor, internal_name, expected_revision_token):
    announcement = lock_announcement(announcement)
    _assert_revision_token(announcement, expected_revision_token)
    previous_name = announcement.internal_name
    announcement.internal_name = internal_name.strip()
    announcement.revision_token += 1
    announcement.full_clean()
    announcement.save(update_fields=['internal_name', 'revision_token', 'updated_at'])
    _record_action(
        actor=actor,
        action='announcement_rename',
        announcement=announcement,
        payload={'changed': previous_name != announcement.internal_name},
    )
    return announcement


@transaction.atomic
def create_announcement_revision(
    *,
    announcement,
    actor,
    revision_data,
    expected_revision_token,
):
    announcement = lock_announcement(announcement)
    _assert_revision_token(announcement, expected_revision_token)
    if announcement.lifecycle_state == Announcement.LifecycleState.ARCHIVED:
        raise ValidationError(
            {'lifecycle_state': 'Thông báo đã lưu trữ không thể tạo revision mới.'}
        )
    latest_number = (
        AnnouncementRevision.objects.filter(announcement=announcement).aggregate(
            maximum=Max('number')
        )['maximum']
        or 0
    )
    revision = _create_revision(
        announcement=announcement,
        actor=actor,
        number=latest_number + 1,
        revision_data=revision_data,
    )
    announcement.revision_token += 1
    announcement.save(update_fields=['revision_token', 'updated_at'])
    _record_action(
        actor=actor,
        action='announcement_create_revision',
        announcement=announcement,
        payload={'revision': revision.number},
    )
    return announcement, revision


@transaction.atomic
def publish_announcement(
    *,
    announcement,
    actor,
    revision_number,
    expected_revision_token,
):
    announcement = lock_announcement(announcement)
    _assert_revision_token(announcement, expected_revision_token)
    if announcement.lifecycle_state == Announcement.LifecycleState.ARCHIVED:
        raise ValidationError({'lifecycle_state': 'Thông báo đã lưu trữ không thể phát hành lại.'})
    revision = AnnouncementRevision.objects.filter(
        announcement=announcement,
        number=revision_number,
    ).first()
    if revision is None:
        raise ValidationError({'revision': 'Revision không tồn tại trong thông báo này.'})
    revision.full_clean()
    now = timezone.now()
    if revision.published_at is None:
        revision.published_at = now
        revision.save(update_fields=['published_at'])
    announcement.active_revision = revision
    announcement.lifecycle_state = Announcement.LifecycleState.PUBLISHED
    announcement.published_by = actor
    announcement.published_at = now
    announcement.paused_at = None
    announcement.archived_at = None
    announcement.revision_token += 1
    announcement.save(
        update_fields=[
            'active_revision',
            'lifecycle_state',
            'published_by',
            'published_at',
            'paused_at',
            'archived_at',
            'revision_token',
            'updated_at',
        ]
    )
    _record_action(
        actor=actor,
        action='announcement_publish',
        announcement=announcement,
        payload={'revision': revision.number},
    )
    return announcement


def _transition(
    *,
    announcement,
    actor,
    expected_revision_token,
    from_states,
    to_state,
    action,
):
    announcement = lock_announcement(announcement)
    _assert_revision_token(announcement, expected_revision_token)
    if announcement.lifecycle_state not in from_states:
        raise ValidationError({'lifecycle_state': f'Không thể {action} từ trạng thái hiện tại.'})
    now = timezone.now()
    announcement.lifecycle_state = to_state
    announcement.revision_token += 1
    update_fields = ['lifecycle_state', 'revision_token', 'updated_at']
    if to_state == Announcement.LifecycleState.PAUSED:
        announcement.paused_at = now
        update_fields.append('paused_at')
    elif to_state == Announcement.LifecycleState.PUBLISHED:
        announcement.paused_at = None
        update_fields.append('paused_at')
    elif to_state == Announcement.LifecycleState.ARCHIVED:
        announcement.archived_at = now
        update_fields.append('archived_at')
    announcement.save(update_fields=update_fields)
    _record_action(
        actor=actor,
        action=f'announcement_{action}',
        announcement=announcement,
        payload={
            'revision': (
                announcement.active_revision.number if announcement.active_revision_id else None
            )
        },
    )
    return announcement


@transaction.atomic
def pause_announcement(*, announcement, actor, expected_revision_token):
    return _transition(
        announcement=announcement,
        actor=actor,
        expected_revision_token=expected_revision_token,
        from_states={Announcement.LifecycleState.PUBLISHED},
        to_state=Announcement.LifecycleState.PAUSED,
        action='pause',
    )


@transaction.atomic
def resume_announcement(*, announcement, actor, expected_revision_token):
    return _transition(
        announcement=announcement,
        actor=actor,
        expected_revision_token=expected_revision_token,
        from_states={Announcement.LifecycleState.PAUSED},
        to_state=Announcement.LifecycleState.PUBLISHED,
        action='resume',
    )


@transaction.atomic
def reset_announcement_dismissals(*, announcement, actor, expected_revision_token):
    """Show a published announcement again to readers who closed or snoozed it.

    A dismissal is keyed by ``(announcement, dismissal_version)`` on the server
    and by the same version in the browser's local storage, so editing the
    wording alone never reaches someone who already dismissed it.  Advancing the
    version is a deliberate act — a typo fix should not re-interrupt everyone —
    which is why it is its own action instead of a side effect of publishing.
    """
    announcement = lock_announcement(announcement)
    _assert_revision_token(announcement, expected_revision_token)
    if announcement.lifecycle_state != Announcement.LifecycleState.PUBLISHED:
        raise ValidationError(
            {'lifecycle_state': 'Chỉ thông báo đang phát hành mới hiện lại được.'}
        )
    # Existing state rows stay: they record what a reader dismissed and become
    # inert once the active version moves past them.
    announcement.dismissal_version += 1
    announcement.revision_token += 1
    announcement.save(update_fields=['dismissal_version', 'revision_token', 'updated_at'])
    _record_action(
        actor=actor,
        action='announcement_reset_dismissals',
        announcement=announcement,
        payload={'dismissal_version': announcement.dismissal_version},
    )
    return announcement


@transaction.atomic
def archive_announcement(*, announcement, actor, expected_revision_token):
    return _transition(
        announcement=announcement,
        actor=actor,
        expected_revision_token=expected_revision_token,
        from_states={
            Announcement.LifecycleState.DRAFT,
            Announcement.LifecycleState.PUBLISHED,
            Announcement.LifecycleState.PAUSED,
        },
        to_state=Announcement.LifecycleState.ARCHIVED,
        action='archive',
    )


@transaction.atomic
def duplicate_announcement(
    *,
    announcement,
    actor,
    internal_name,
    expected_revision_token,
):
    announcement = lock_announcement(announcement)
    _assert_revision_token(announcement, expected_revision_token)
    source = announcement.revisions.order_by('-number').first()
    if source is None:
        raise ValidationError({'detail': 'Thông báo nguồn chưa có revision.'})
    revision_data = {field: getattr(source, field) for field in REVISION_COPY_FIELDS}
    duplicate = Announcement(
        internal_name=internal_name.strip(),
        created_by=actor,
    )
    duplicate.full_clean()
    duplicate.save()
    _create_revision(
        announcement=duplicate,
        actor=actor,
        number=1,
        revision_data=revision_data,
    )
    announcement.revision_token += 1
    announcement.save(update_fields=['revision_token', 'updated_at'])
    _record_action(
        actor=actor,
        action='announcement_duplicate',
        announcement=announcement,
        payload={'duplicate_public_id': duplicate.public_id},
    )
    _record_action(
        actor=actor,
        action='announcement_create_from_duplicate',
        announcement=duplicate,
        payload={'source_public_id': announcement.public_id},
    )
    return duplicate

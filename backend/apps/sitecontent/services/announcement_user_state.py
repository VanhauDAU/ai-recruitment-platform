"""A signed-in reader dismissing or snoozing the live announcement."""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from common.errors import DomainError

from ..models import (
    Announcement,
    AnnouncementRevision,
    AnnouncementUserState,
)
from .announcement_lifecycle import lock_announcement


class StaleAnnouncementState(DomainError):
    status_code = 409
    code = 'announcement_state_stale'

    def __init__(self, *, current_revision, current_dismissal_version):
        self.current_revision = current_revision
        self.current_dismissal_version = current_dismissal_version
        super().__init__('Announcement state contract is stale.')

    def payload(self):
        return {
            'code': self.code,
            'detail': 'Thông báo đã thay đổi. Hãy tải lại feed trước khi thao tác.',
            'current_revision': self.current_revision,
            'current_dismissal_version': self.current_dismissal_version,
        }


@transaction.atomic
def set_announcement_user_state(
    *,
    announcement,
    user,
    revision_number,
    dismissal_version,
    action,
):
    announcement = lock_announcement(announcement)
    active_revision = announcement.active_revision
    if (
        announcement.lifecycle_state != Announcement.LifecycleState.PUBLISHED
        or active_revision is None
    ):
        raise ValidationError({'detail': 'Thông báo không còn hoạt động.'})
    if (
        active_revision.number != revision_number
        or announcement.dismissal_version != dismissal_version
    ):
        raise StaleAnnouncementState(
            current_revision=active_revision.number,
            current_dismissal_version=announcement.dismissal_version,
        )
    if active_revision.dismiss_mode == AnnouncementRevision.DismissMode.LOCKED:
        raise ValidationError({'action': 'Thông báo này không thể đóng hoặc tạm ẩn.'})
    expected_action = (
        'snooze'
        if active_revision.dismiss_mode == AnnouncementRevision.DismissMode.SNOOZE
        else 'dismiss'
    )
    if action != expected_action:
        raise ValidationError({'action': f'Thông báo này chỉ hỗ trợ action {expected_action}.'})

    state, _ = AnnouncementUserState.objects.select_for_update().get_or_create(
        user=user,
        announcement=announcement,
        dismissal_version=dismissal_version,
    )
    now = timezone.now()
    if action == 'dismiss':
        if state.dismissed_at is None:
            state.dismissed_at = now
            state.snoozed_until = None
            state.save(update_fields=['dismissed_at', 'snoozed_until', 'updated_at'])
    elif state.snoozed_until is None or state.snoozed_until <= now:
        state.dismissed_at = None
        state.snoozed_until = now + timedelta(seconds=active_revision.snooze_seconds)
        state.save(update_fields=['dismissed_at', 'snoozed_until', 'updated_at'])
    return state

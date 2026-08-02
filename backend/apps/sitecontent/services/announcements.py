from datetime import timedelta
from hashlib import sha256
from urllib.parse import urlsplit
from uuid import uuid4
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F, Max
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.services import record_admin_action
from apps.privacy.constants import VIEWER_SIGNING_SALT
from common.metrics import record_metric

from ..models import (
    Announcement,
    AnnouncementDailyMetric,
    AnnouncementRevision,
    AnnouncementUserState,
)


class StaleAnnouncementRevision(Exception):
    def __init__(self, current_revision_token):
        self.current_revision_token = current_revision_token
        super().__init__('Announcement revision token is stale.')


class StaleAnnouncementState(Exception):
    def __init__(self, *, current_revision, current_dismissal_version):
        self.current_revision = current_revision
        self.current_dismissal_version = current_dismissal_version
        super().__init__('Announcement state contract is stale.')


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
)


def _normalized_unique_list(values):
    return list(dict.fromkeys(values))


def normalize_path_prefix(prefix):
    prefix = prefix.strip()
    if (
        not prefix.startswith('/')
        or prefix.startswith('//')
        or '?' in prefix
        or '#' in prefix
        or len(prefix) > 500
    ):
        raise ValidationError('Prefix phải là application path tuyệt đối, không có query/hash.')
    if prefix != '/':
        prefix = prefix.rstrip('/')
    return prefix or '/'


def validate_cta_url(url):
    if not url:
        return ''
    if url.startswith('/') and not url.startswith('//'):
        return url
    parsed = urlsplit(url)
    if (
        parsed.scheme != 'https'
        or not parsed.netloc
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValidationError('URL ngoài phải dùng HTTPS và không được chứa credential.')
    return url


def normalize_revision_data(data):
    normalized = dict(data)
    list_contracts = {
        'surfaces': set(AnnouncementRevision.Surface.values),
        'auth_audiences': set(AnnouncementRevision.Audience.values),
        'roles': set(User.Role.values),
    }
    for field, allowed in list_contracts.items():
        values = _normalized_unique_list(normalized.get(field, []))
        invalid = set(values) - allowed
        if invalid:
            raise ValidationError({field: f'Giá trị không hợp lệ: {", ".join(sorted(invalid))}.'})
        normalized[field] = values
    if not normalized['surfaces']:
        raise ValidationError({'surfaces': 'Chọn ít nhất một surface.'})
    if not normalized['auth_audiences']:
        raise ValidationError({'auth_audiences': 'Chọn ít nhất một audience.'})

    for field in ('include_path_prefixes', 'exclude_path_prefixes'):
        try:
            normalized[field] = _normalized_unique_list(
                normalize_path_prefix(value) for value in normalized.get(field, [])
            )
        except (AttributeError, ValidationError) as error:
            raise ValidationError({field: str(error)}) from error
    try:
        normalized['cta_url'] = validate_cta_url(normalized.get('cta_url', '').strip())
    except ValidationError as error:
        raise ValidationError({'cta_url': error.messages}) from error
    return normalized


def _assert_revision_token(announcement, expected_revision_token):
    if announcement.revision_token != expected_revision_token:
        raise StaleAnnouncementRevision(announcement.revision_token)


def _lock_announcement(announcement):
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
    announcement = _lock_announcement(announcement)
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
    announcement = _lock_announcement(announcement)
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
    announcement = _lock_announcement(announcement)
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
    announcement = _lock_announcement(announcement)
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
    announcement = _lock_announcement(announcement)
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
    announcement = _lock_announcement(announcement)
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


@transaction.atomic
def set_announcement_user_state(
    *,
    announcement,
    user,
    revision_number,
    dismissal_version,
    action,
):
    announcement = _lock_announcement(announcement)
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


def _viewer_id_from_request(request):
    raw_value = request.COOKIES.get(settings.JOB_VIEWER_COOKIE_NAME)
    if raw_value:
        try:
            value = signing.loads(raw_value, salt=VIEWER_SIGNING_SALT)
            if isinstance(value, str) and value:
                return value, False
        except signing.BadSignature:
            pass
    return str(uuid4()), True


def set_announcement_viewer_cookie(response, viewer_id):
    if not viewer_id:
        return
    response.set_cookie(
        settings.JOB_VIEWER_COOKIE_NAME,
        signing.dumps(viewer_id, salt=VIEWER_SIGNING_SALT, compress=True),
        max_age=settings.JOB_VIEWER_COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.JOB_VIEWER_COOKIE_SECURE,
        samesite=settings.JOB_VIEWER_COOKIE_SAMESITE,
        path='/',
    )


def _tracking_date():
    return timezone.localdate(timezone=ZoneInfo('Asia/Ho_Chi_Minh'))


def _dedupe_ttl_seconds():
    local_now = timezone.localtime(timezone.now(), timezone=ZoneInfo('Asia/Ho_Chi_Minh'))
    next_day = (local_now + timedelta(days=1)).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    return max(int((next_day - local_now).total_seconds()) + 300, 300)


def _claim_unique_event(key):
    try:
        return cache.add(key, '1', timeout=_dedupe_ttl_seconds())
    except Exception:
        return None


@transaction.atomic
def _increment_announcement_metric(*, revision, surface, event):
    metric, _ = AnnouncementDailyMetric.objects.get_or_create(
        announcement_revision=revision,
        date=_tracking_date(),
        surface=surface,
    )
    fields = {
        'impression': ('impressions', 'unique_impressions'),
        'click': ('clicks', 'unique_clicks'),
        'dismiss': ('dismisses',),
    }[event]
    AnnouncementDailyMetric.objects.filter(pk=metric.pk).update(
        **{field: F(field) + 1 for field in fields}
    )


def record_consented_announcement_events(request, events):
    viewer_id, viewer_created = _viewer_id_from_request(request)
    viewer_hash = sha256(viewer_id.encode()).hexdigest()
    user_id = request.user.pk if request.user.is_authenticated else None
    tracking_date = _tracking_date().isoformat()
    results = []
    for event in events:
        revision = event['revision_object']
        identity = f'user:{user_id}' if user_id else f'viewer:{viewer_hash}'
        dedupe_key = (
            f'announcement-event:{revision.pk}:{event["surface"]}:'
            f'{event["event"]}:{tracking_date}:{identity}'
        )
        claimed = _claim_unique_event(dedupe_key)
        reason = 'counted'
        if claimed is None:
            reason = 'redis_error'
        elif not claimed:
            reason = 'duplicate'
        else:
            _increment_announcement_metric(
                revision=revision,
                surface=event['surface'],
                event=event['event'],
            )
        record_metric(
            'announcement_analytics',
            event=event['event'],
            reason=reason,
            surface=event['surface'],
        )
        results.append(reason)
    return {
        'results': results,
        'viewer_id': viewer_id if viewer_created else None,
    }

from datetime import UTC, datetime

from django.db.models import Max, Prefetch, Q
from django.utils import timezone

from ..models import Announcement, AnnouncementRevision

PRIORITY_TIER_BY_KIND = {
    AnnouncementRevision.Kind.CRITICAL: 1,
    AnnouncementRevision.Kind.SECURITY: 2,
    AnnouncementRevision.Kind.COMPLIANCE: 3,
    AnnouncementRevision.Kind.WARNING: 4,
    AnnouncementRevision.Kind.MAINTENANCE: 4,
    AnnouncementRevision.Kind.INFO: 6,
    AnnouncementRevision.Kind.SUCCESS: 6,
    AnnouncementRevision.Kind.EVENT: 6,
    AnnouncementRevision.Kind.FEATURE: 6,
}


def normalize_request_path(path):
    path = (path or '/').split('?', 1)[0].split('#', 1)[0]
    if not path.startswith('/') or path.startswith('//') or len(path) > 500:
        return '/'
    if path != '/':
        path = path.rstrip('/')
    return path or '/'


def path_prefix_matches(path, prefix):
    if prefix == '/':
        return True
    return path == prefix or path.startswith(f'{prefix}/')


def revision_targets_request(revision, *, surface, path, user):
    if surface not in revision.surfaces:
        return False

    authenticated = bool(user and user.is_authenticated)
    audience = (
        AnnouncementRevision.Audience.AUTHENTICATED
        if authenticated
        else AnnouncementRevision.Audience.GUEST
    )
    if audience not in revision.auth_audiences:
        return False
    if revision.roles and (not authenticated or user.role not in revision.roles):
        return False
    if surface == AnnouncementRevision.Surface.ADMIN_WORKSPACE and (
        not authenticated or not user.is_admin_role
    ):
        return False
    if surface == AnnouncementRevision.Surface.EMPLOYER_WORKSPACE and (
        not authenticated or not user.is_employer
    ):
        return False

    path = normalize_request_path(path)
    if any(path_prefix_matches(path, prefix) for prefix in revision.exclude_path_prefixes):
        return False
    return not revision.include_path_prefixes or any(
        path_prefix_matches(path, prefix) for prefix in revision.include_path_prefixes
    )


def _schedule_status(revision, now):
    if revision.starts_at and revision.starts_at > now:
        return 'scheduled'
    if revision.ends_at and revision.ends_at <= now:
        return 'ended'
    return 'live'


def presentation_status(announcement, *, now=None):
    now = now or timezone.now()
    if announcement.lifecycle_state != Announcement.LifecycleState.PUBLISHED:
        return announcement.lifecycle_state
    if not announcement.active_revision_id:
        return Announcement.LifecycleState.DRAFT
    return _schedule_status(announcement.active_revision, now)


def active_announcements_for_request(*, surface, path, user, now=None):
    now = now or timezone.now()
    queryset = (
        Announcement.objects.filter(
            lifecycle_state=Announcement.LifecycleState.PUBLISHED,
            active_revision__isnull=False,
        )
        .select_related('active_revision')
        .order_by('id')
    )

    targeted = []
    transition_candidates = []
    for announcement in queryset:
        revision = announcement.active_revision
        if not revision_targets_request(
            revision,
            surface=surface,
            path=path,
            user=user,
        ):
            continue
        if revision.starts_at and revision.starts_at > now:
            transition_candidates.append(revision.starts_at)
            continue
        if revision.ends_at and revision.ends_at <= now:
            continue
        if revision.ends_at:
            transition_candidates.append(revision.ends_at)
        targeted.append(announcement)

    if not targeted:
        return [], min(transition_candidates, default=None)

    highest_tier = min(PRIORITY_TIER_BY_KIND[item.active_revision.kind] for item in targeted)
    items = [
        item
        for item in targeted
        if PRIORITY_TIER_BY_KIND[item.active_revision.kind] == highest_tier
    ]
    items.sort(
        key=lambda item: (
            -item.active_revision.priority,
            item.active_revision.starts_at or datetime.min.replace(tzinfo=UTC),
            item.public_id,
        )
    )
    return items, min(transition_candidates, default=None)


def admin_announcements_queryset(params=None):
    params = params or {}
    queryset = Announcement.objects.select_related(
        'active_revision',
        'created_by',
        'published_by',
    ).annotate(latest_revision_number=Max('revisions__number'))
    if query := (params.get('q') or '').strip():
        queryset = queryset.filter(
            Q(internal_name__icontains=query) | Q(public_id__icontains=query)
        )
    if lifecycle_state := params.get('lifecycle_state'):
        queryset = queryset.filter(lifecycle_state=lifecycle_state)
    if kind := params.get('kind'):
        queryset = queryset.filter(active_revision__kind=kind)
    if surface := params.get('surface'):
        queryset = queryset.filter(active_revision__surfaces__contains=[surface])

    ordering = params.get('ordering') or '-updated_at'
    descending = ordering.startswith('-')
    ordering_key = ordering.removeprefix('-')
    ordering_fields = {
        'internal_name': 'internal_name',
        'lifecycle_state': 'lifecycle_state',
        'kind': 'active_revision__kind',
        'starts_at': 'active_revision__starts_at',
        'ends_at': 'active_revision__ends_at',
        'priority': 'active_revision__priority',
        'published_at': 'published_at',
        'created_at': 'created_at',
        'updated_at': 'updated_at',
    }
    field = ordering_fields.get(ordering_key)
    if not field:
        return queryset.order_by('-updated_at', '-id')
    prefix = '-' if descending else ''
    return queryset.order_by(f'{prefix}{field}', f'{prefix}id')


def admin_announcement_detail_queryset():
    revisions = AnnouncementRevision.objects.select_related(
        'announcement',
        'created_by',
    ).order_by('-number')
    return (
        Announcement.objects.select_related(
            'active_revision',
            'created_by',
            'published_by',
        )
        .annotate(latest_revision_number=Max('revisions__number'))
        .prefetch_related(Prefetch('revisions', queryset=revisions))
    )

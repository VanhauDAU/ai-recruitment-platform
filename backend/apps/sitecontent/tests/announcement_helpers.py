from datetime import timedelta

from django.utils import timezone

from apps.accounts.models import (
    AdminMembership,
    AdminPermission,
    AdminRole,
    Department,
    User,
)

from ..models import AnnouncementRevision


def revision_payload(**overrides):
    payload = {
        'message_vi': 'Khám phá cơ hội việc làm mới.',
        'message_en': 'Discover new job opportunities.',
        'badge_vi': 'Mới',
        'badge_en': 'New',
        'icon': AnnouncementRevision.Icon.SPARKLES,
        'cta_label_vi': 'Xem ngay',
        'cta_label_en': 'Explore',
        'cta_url': '/viec-lam',
        'kind': AnnouncementRevision.Kind.INFO,
        'surfaces': [AnnouncementRevision.Surface.CANDIDATE],
        'auth_audiences': [
            AnnouncementRevision.Audience.GUEST,
            AnnouncementRevision.Audience.AUTHENTICATED,
        ],
        'roles': [],
        'include_path_prefixes': [],
        'exclude_path_prefixes': [],
        'starts_at': timezone.now().isoformat(),
        'ends_at': (timezone.now() + timedelta(days=7)).isoformat(),
        'priority': 50,
        'animation': AnnouncementRevision.Animation.SLIDE,
        'display_seconds': 6,
        'dismiss_mode': AnnouncementRevision.DismissMode.CLOSE,
        'snooze_seconds': None,
    }
    payload.update(overrides)
    return payload


def create_admin_with_permissions(*codes, email='announcement-admin@example.com'):
    admin = User.objects.create_user(
        email=email,
        password='Password@123',
        role=User.Role.ADMIN,
    )
    department = Department.objects.create(
        code=f'announcements-{admin.pk}',
        name='Thông báo',
    )
    role = AdminRole.objects.create(
        department=department,
        code='operator',
        name='Điều phối thông báo',
        rank=10,
    )
    permissions = []
    for code in codes:
        permission, _ = AdminPermission.objects.get_or_create(
            code=code,
            defaults={
                'module': 'announcement',
                'label': code,
            },
        )
        permissions.append(permission)
    role.permissions.set(permissions)
    AdminMembership.objects.create(user=admin, role=role, is_primary=True)
    return admin

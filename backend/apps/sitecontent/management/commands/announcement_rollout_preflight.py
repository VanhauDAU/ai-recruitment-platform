"""Read-only readiness report for the announcement rollout."""

import json
from collections import Counter, defaultdict

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from ...models import Announcement, AnnouncementRevision
from ...selectors import PRIORITY_TIER_BY_KIND

VALID_SURFACES = {value for value, _label in AnnouncementRevision.Surface.choices}


class Command(BaseCommand):
    help = (
        'Kiểm tra kill switch, lifecycle và nhóm rotation trước khi rollout '
        'announcement. Command chỉ đọc dữ liệu.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--require-live-surface',
            action='append',
            default=[],
            choices=sorted(VALID_SURFACES),
            help='Fail nếu surface được nêu không có announcement live.',
        )
        parser.add_argument(
            '--json',
            action='store_true',
            dest='as_json',
            help='In báo cáo JSON để lưu làm deployment evidence.',
        )

    def handle(self, *args, **options):
        now = timezone.now()
        configured = set(settings.ANNOUNCEMENT_REMOTE_ENABLED_SURFACES)
        invalid_surfaces = sorted(configured - VALID_SURFACES)
        enabled_surfaces = sorted(configured & VALID_SURFACES)
        live_by_surface = Counter()
        scheduled_by_surface = Counter()
        ended = 0
        errors = []
        warnings = []
        rotation_candidates = defaultdict(list)

        if invalid_surfaces:
            errors.append('Kill switch chứa surface không hợp lệ: ' + ', '.join(invalid_surfaces))

        announcements = list(
            Announcement.objects.filter(
                lifecycle_state=Announcement.LifecycleState.PUBLISHED,
            )
            .select_related('active_revision')
            .order_by('public_id')
        )
        for announcement in announcements:
            revision = announcement.active_revision
            if revision is None:
                errors.append(f'{announcement.public_id}: published nhưng thiếu active revision.')
                continue
            if revision.kind == AnnouncementRevision.Kind.CRITICAL and revision.ends_at is None:
                errors.append(f'{announcement.public_id}: critical thiếu ends_at.')

            is_ended = bool(revision.ends_at and revision.ends_at <= now)
            is_scheduled = bool(revision.starts_at and revision.starts_at > now)
            if is_ended:
                ended += 1
                continue

            for surface in sorted(set(revision.surfaces) & VALID_SURFACES):
                if is_scheduled:
                    scheduled_by_surface[surface] += 1
                else:
                    live_by_surface[surface] += 1
                    rotation_candidates[
                        (
                            surface,
                            PRIORITY_TIER_BY_KIND[revision.kind],
                            revision.priority,
                        )
                    ].append(announcement.public_id)

        for surface in enabled_surfaces:
            if not live_by_surface[surface] and not scheduled_by_surface[surface]:
                warnings.append(f'{surface}: kill switch bật nhưng chưa có item live/scheduled.')
        for surface in options['require_live_surface']:
            if surface not in configured:
                errors.append(f'{surface}: được require nhưng kill switch đang tắt.')
            elif not live_by_surface[surface]:
                errors.append(f'{surface}: không có announcement live để smoke test.')

        rotation_groups = [
            {
                'surface': surface,
                'tier': tier,
                'priority': priority,
                'public_ids': public_ids,
            }
            for (surface, tier, priority), public_ids in sorted(rotation_candidates.items())
            if len(public_ids) > 1
        ]
        report = {
            'status': 'error' if errors else 'ok',
            'checked_at': now.isoformat(),
            'enabled_surfaces': enabled_surfaces,
            'published_announcements': len(announcements),
            'live_by_surface': {
                surface: live_by_surface[surface] for surface in sorted(VALID_SURFACES)
            },
            'scheduled_by_surface': {
                surface: scheduled_by_surface[surface] for surface in sorted(VALID_SURFACES)
            },
            'ended_announcements': ended,
            'rotation_groups': rotation_groups,
            'warnings': warnings,
            'errors': errors,
        }

        if options['as_json']:
            self.stdout.write(json.dumps(report, ensure_ascii=False, sort_keys=True))
        else:
            self.stdout.write(
                self.style.SUCCESS('Announcement rollout preflight: OK')
                if not errors
                else self.style.ERROR('Announcement rollout preflight: ERROR')
            )
            self.stdout.write(f'Enabled surfaces: {", ".join(enabled_surfaces) or "none"}')
            self.stdout.write(f'Published announcements: {len(announcements)}')
            for surface in sorted(VALID_SURFACES):
                self.stdout.write(
                    f'- {surface}: live={live_by_surface[surface]}, '
                    f'scheduled={scheduled_by_surface[surface]}'
                )
            self.stdout.write(f'Rotation groups: {len(rotation_groups)}')
            for warning in warnings:
                self.stdout.write(self.style.WARNING(f'WARN: {warning}'))
            for error in errors:
                self.stdout.write(self.style.ERROR(f'ERROR: {error}'))

        if errors:
            raise CommandError('Announcement rollout preflight failed.')

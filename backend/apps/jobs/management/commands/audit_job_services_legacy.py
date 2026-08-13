import hashlib
import json
import os
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Count, F, Q
from django.utils import timezone

from apps.services.models import ServicePackage

from ...models import Job


class Command(BaseCommand):
    help = 'Xuất baseline chỉ-đọc cho migration job lifecycle và dịch vụ legacy.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--anomaly-limit',
            type=int,
            default=100,
            help='Số public ID tối đa cho mỗi nhóm bất thường.',
        )

    def handle(self, *args, **options):
        anomaly_limit = max(0, min(options['anomaly_limit'], 1000))
        now = timezone.now()
        today = timezone.localdate(now)
        lifetime_cutoff = now - timedelta(
            days=int(getattr(settings, 'JOB_POSTING_MAX_PUBLIC_LIFETIME_DAYS', 90))
        )

        status_counts = {
            row['status']: row['total']
            for row in Job.objects.values('status').annotate(total=Count('id')).order_by('status')
        }
        tier_counts = {
            row['tier']: row['total']
            for row in Job.objects.values('tier').annotate(total=Count('id')).order_by('tier')
        }
        repeated_approval_ids = list(
            Job.objects.annotate(
                approval_count=Count(
                    'status_history',
                    filter=Q(status_history__to_status=Job.Status.ACTIVE),
                )
            )
            .filter(approval_count__gte=2)
            .order_by('public_id')
            .values_list('public_id', flat=True)[:anomaly_limit]
        )

        anomaly_queries = {
            'active_expired_application_deadline': Job.objects.filter(
                status=Job.Status.ACTIVE,
                deadline__lt=today,
            ),
            'active_missing_published_at': Job.objects.filter(
                status=Job.Status.ACTIVE,
                published_at__isnull=True,
            ),
            'active_published_over_max_lifetime': Job.objects.filter(
                status=Job.Status.ACTIVE,
                published_at__lt=lifetime_cutoff,
            ),
            'deadline_before_published_date': Job.objects.filter(
                deadline__isnull=False,
                published_at__isnull=False,
                deadline__lt=F('published_at__date'),
            ),
        }
        anomalies = {
            key: {
                'count': queryset.count(),
                'public_ids': list(
                    queryset.order_by('public_id').values_list('public_id', flat=True)[
                        :anomaly_limit
                    ]
                ),
            }
            for key, queryset in anomaly_queries.items()
        }
        anomalies['repeated_approval'] = {
            'count': (
                Job.objects.annotate(
                    approval_count=Count(
                        'status_history',
                        filter=Q(status_history__to_status=Job.Status.ACTIVE),
                    )
                )
                .filter(approval_count__gte=2)
                .count()
            ),
            'public_ids': repeated_approval_ids,
        }

        report = {
            'generated_at': now.isoformat(),
            'environment': getattr(settings, 'ENVIRONMENT', 'unknown'),
            'app_revision': os.environ.get('APP_REVISION', 'unknown'),
            'job_counts': {
                'total': Job.objects.count(),
                'by_status': status_counts,
                'by_tier': tier_counts,
                'hot': Job.objects.filter(is_hot=True).count(),
                'urgent': Job.objects.filter(is_urgent=True).count(),
                'flash': Job.objects.filter(has_flash_badge=True).count(),
                'promotion_overlap': Job.objects.filter(
                    Q(is_hot=True) | Q(is_urgent=True) | Q(has_flash_badge=True)
                )
                .exclude(tier=Job.Tier.STANDARD)
                .count(),
            },
            'service_package_counts': {
                'total': ServicePackage.objects.count(),
                'active': ServicePackage.objects.filter(is_active=True).count(),
                'inactive': ServicePackage.objects.filter(is_active=False).count(),
            },
            'anomalies': anomalies,
        }
        checksum_payload = json.dumps(report, ensure_ascii=False, sort_keys=True).encode()
        report['checksum_sha256'] = hashlib.sha256(checksum_payload).hexdigest()
        self.stdout.write(json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2))

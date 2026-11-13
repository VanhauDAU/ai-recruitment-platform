"""Seed the approval baseline for jobs approved before snapshots existed.

An active job is showing exactly the content an administrator approved, so its
current content is a valid baseline. Pending jobs are skipped: their content is
already the edited revision and the approved one cannot be reconstructed.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from ...models import Job
from ...services import build_job_content_snapshot


class Command(BaseCommand):
    help = 'Backfill approved_snapshot for active jobs that have no baseline yet.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Recapture the baseline even when a job already has one.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        jobs = Job.objects.filter(
            status=Job.Status.ACTIVE,
            approved_at__isnull=False,
        ).prefetch_related(
            'category_assignments__category',
            'job_locations__location__parent',
            'job_skills__skill',
            'work_schedules',
            'job_benefits__benefit',
            'language_requirements__language',
            'application_contact__emails',
        )
        if not options['force']:
            jobs = jobs.filter(approved_snapshot={})

        updated = []
        for job in jobs:
            job.approved_snapshot = build_job_content_snapshot(job)
            job.approved_snapshot_at = job.approved_at
            updated.append(job)
        Job.objects.bulk_update(
            updated, ['approved_snapshot', 'approved_snapshot_at'], batch_size=200
        )
        self.stdout.write(self.style.SUCCESS(f'Đã lưu bản duyệt gốc cho {len(updated)} tin.'))

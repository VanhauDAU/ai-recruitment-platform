"""Republish jobs that were waiting for approval when the review queue was removed.

Migration 0046 returned every pending job to its recruiter as a draft. This
command sends those drafts through the normal publish workflow on behalf of
their owners, so a job becomes public only when it passes the same checks as
any other publication. Jobs that fail stay drafts for the recruiter to fix.
Their recruiters submitted them before the publication commitment existed, so
these jobs go public without an acknowledgement on record.
Run it once per environment after migrating; it is safe to run again.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from rest_framework.exceptions import APIException

from ...models import Job, JobStatusHistory
from ...services import publish_job

# Must stay identical to CONVERSION_NOTE in migration 0046.
CONVERSION_NOTE = 'Chuyển về bản nháp khi bỏ quy trình duyệt tin (ADR-0014).'


class Command(BaseCommand):
    help = 'Đăng lại các tin từng ở trạng thái chờ duyệt, nếu tin đạt điều kiện đăng.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Ghi thay đổi. Mặc định chỉ chạy thử và hoàn tác.',
        )

    def handle(self, *args, **options):
        apply_changes = options['apply']
        converted_job_ids = JobStatusHistory.objects.filter(
            from_status='pending',
            to_status=Job.Status.DRAFT,
            actor_role=JobStatusHistory.ActorRole.SYSTEM,
            note=CONVERSION_NOTE,
        ).values_list('job_id', flat=True)
        jobs = Job.objects.filter(
            pk__in=converted_job_ids,
            status=Job.Status.DRAFT,
        ).select_related('posted_by')

        published = []
        blocked = []
        for job in jobs:
            try:
                with transaction.atomic():
                    publish_job(job, job.posted_by, submitted_before_commitment=True)
                    if not apply_changes:
                        transaction.set_rollback(True)
            except APIException as error:
                blocked.append((job.public_id, error.detail))
            else:
                published.append(job.public_id)

        for public_id, detail in blocked:
            self.stdout.write(f'Giữ ở bản nháp {public_id}: {detail}')
        verb = 'Đã đăng' if apply_changes else 'Sẽ đăng'
        self.stdout.write(
            self.style.SUCCESS(f'{verb} {len(published)} tin; {len(blocked)} tin giữ ở bản nháp.')
        )
        if not apply_changes:
            self.stdout.write('Chạy thử: chưa ghi thay đổi. Thêm --apply để thực hiện.')

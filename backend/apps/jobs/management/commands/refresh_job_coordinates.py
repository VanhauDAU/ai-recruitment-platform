from django.core.management.base import BaseCommand

from apps.jobs.models import Job
from apps.jobs.services import refresh_job_coordinates


class Command(BaseCommand):
    help = (
        'Backfill workplace coordinates (ADR-0029): ward centroids now, geocoded '
        'addresses via Celery. Default: only jobs with rows never processed.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--all', action='store_true', help='Recompute every job (keeps employer pins)'
        )
        parser.add_argument('--limit', type=int, default=None)

    def handle(self, *args, all=False, limit=None, **options):
        jobs = Job.objects.order_by('pk')
        if not all:
            jobs = jobs.filter(job_locations__coordinate_precision='').distinct()
        if limit:
            jobs = jobs[:limit]
        count = 0
        for job in jobs.iterator(chunk_size=200):
            refresh_job_coordinates(job, force=all)
            count += 1
        self.stdout.write(self.style.SUCCESS(f'Refreshed coordinates of {count} jobs.'))

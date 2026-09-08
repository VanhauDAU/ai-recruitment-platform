import re
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase


class UploadDeploymentContractTests(SimpleTestCase):
    def test_every_routed_queue_is_consumed_by_a_compose_worker(self):
        repository_root = Path(__file__).resolve().parents[4]
        compose_path = repository_root / 'docker-compose.yml'
        if not compose_path.exists():
            self.skipTest('Repository root is not mounted in this backend runtime.')
        compose = compose_path.read_text(encoding='utf-8')
        worker_queue_matches = re.findall(r'celery -A config worker[^\n]* -Q ([^\s]+)', compose)

        self.assertTrue(worker_queue_matches)
        consumed_queues = {
            queue for queue_argument in worker_queue_matches for queue in queue_argument.split(',')
        }
        routed_queues = {
            route['queue']
            for route in settings.CELERY_TASK_ROUTES.values()
            if isinstance(route, dict) and route.get('queue')
        }
        self.assertIn('upload-scan', consumed_queues)
        self.assertTrue(
            routed_queues.issubset(consumed_queues),
            f'Celery workers do not consume routed queues: {routed_queues - consumed_queues}',
        )

    def test_upload_beat_jobs_use_tasks_covered_by_upload_scan_route(self):
        upload_beat_tasks = {
            entry['task']
            for entry in settings.CELERY_BEAT_SCHEDULE.values()
            if entry['task'].startswith('apps.uploads.tasks.')
        }

        self.assertEqual(
            upload_beat_tasks,
            {
                'apps.uploads.tasks.dispatch_pending_upload_scans',
                'apps.uploads.tasks.expire_and_clean_upload_sessions',
            },
        )
        self.assertEqual(
            settings.CELERY_TASK_ROUTES['apps.uploads.tasks.*']['queue'],
            'upload-scan',
        )

from celery.schedules import crontab
from django.conf import settings
from django.test import SimpleTestCase


class BeatScheduleContractTests(SimpleTestCase):
    def test_every_entry_expires_and_points_to_a_registered_task(self):
        from config.celery import app

        app.autodiscover_tasks(force=True)
        for name, entry in settings.CELERY_BEAT_SCHEDULE.items():
            with self.subTest(name):
                self.assertGreater(entry['options']['expires'], 0)
                self.assertIn(entry['task'], app.tasks)

    def test_daily_jobs_run_off_peak_outside_backup_and_reboot_windows(self):
        self.assertEqual(settings.CELERY_TIMEZONE, 'Asia/Ho_Chi_Minh')
        daily = {
            name: entry['schedule']
            for name, entry in settings.CELERY_BEAT_SCHEDULE.items()
            if isinstance(entry['schedule'], crontab)
        }
        self.assertGreaterEqual(len(daily), 14)
        slots = set()
        for name, schedule in daily.items():
            with self.subTest(name):
                (hour,) = schedule.hour
                (minute,) = schedule.minute
                self.assertTrue(1 <= hour <= 5 and hour not in {3, 4}, (hour, minute))
                self.assertNotIn((hour, minute), slots, 'hai job trùng giờ')
                slots.add((hour, minute))
        # Không còn job "mỗi 86400 giây": mốc đó trôi theo giờ deploy.
        self.assertFalse(
            [
                name
                for name, entry in settings.CELERY_BEAT_SCHEDULE.items()
                if entry['schedule'] == 86400.0
            ]
        )

    def test_auth_maintenance_jobs_are_scheduled(self):
        tasks = {entry['task'] for entry in settings.CELERY_BEAT_SCHEDULE.values()}
        self.assertTrue(
            {
                'apps.accounts.tasks.maintenance.flush_expired_jwt_tokens',
                'apps.accounts.tasks.maintenance.clear_expired_django_sessions',
                'apps.accounts.tasks.maintenance.purge_ended_auth_sessions',
                'apps.accounts.tasks.maintenance.purge_finished_auth_email_jobs',
            }.issubset(tasks)
        )

    def test_stale_ai_generation_sweep_does_not_queue_behind_gemini_calls(self):
        from config.celery import app

        route = app.amqp.router.route(
            {}, 'apps.jobs.tasks.ai_generation.recover_stale_job_generations'
        )
        self.assertEqual(route['queue'].name, 'default')
        generation_route = app.amqp.router.route(
            {}, 'apps.jobs.tasks.ai_generation.generate_job_post'
        )
        self.assertEqual(generation_route['queue'].name, 'ai-generation')


class RedisRoleSettingsTests(SimpleTestCase):
    def test_cache_client_fails_fast_but_channel_layer_outlasts_blocking_receive(self):
        from config.settings.components import tasks

        options = tasks.CACHES['default']['OPTIONS']
        self.assertLessEqual(options['SOCKET_TIMEOUT'], 5)
        self.assertLessEqual(options['SOCKET_CONNECT_TIMEOUT'], 5)
        host = tasks.CHANNEL_LAYERS['default']['CONFIG']['hosts'][0]
        self.assertEqual(host['socket_timeout'], tasks.CHANNEL_LAYER_SOCKET_TIMEOUT)

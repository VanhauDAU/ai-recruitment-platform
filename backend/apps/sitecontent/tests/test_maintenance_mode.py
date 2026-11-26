"""Chế độ bảo trì (ADR-0026): cổng người dùng trả 503, quản trị vẫn chạy."""

from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.accounts.models import User

from ..models import SiteSetting


@override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
class MaintenanceModeTests(TestCase):
    def setUp(self):
        cache.clear()
        SiteSetting.objects.update_or_create(
            key='maintenance_mode',
            defaults={'value': True, 'value_type': SiteSetting.ValueType.BOOLEAN},
        )
        SiteSetting.objects.update_or_create(
            key='maintenance_message', defaults={'value': 'Nâng cấp tới 22h.'}
        )

    def test_portal_and_public_apis_answer_503_with_the_message(self):
        for path in ('/api/public/jobs/', '/api/candidate/profile/', '/api/employer/me/'):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 503)
                self.assertEqual(
                    response.json(), {'code': 'maintenance', 'detail': 'Nâng cấp tới 22h.'}
                )
                self.assertEqual(response['Retry-After'], '600')

    def test_admin_settings_and_health_stay_available(self):
        admin = User.objects.create_user(
            email='root@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        self.client.force_login(admin)

        self.assertEqual(self.client.get('/api/public/site/settings/').status_code, 200)
        self.assertEqual(self.client.get('/api/health/').status_code, 200)
        self.assertNotEqual(self.client.get('/api/admin/site/settings/').status_code, 503)

    def test_server_rendered_seo_pages_keep_their_body_but_answer_503_without_index(self):
        response = self.client.get('/robots.txt')

        self.assertEqual(response.status_code, 503)
        self.assertContains(response, 'User-agent', status_code=503)
        self.assertEqual(response['X-Robots-Tag'], 'noindex')
        self.assertEqual(response['Retry-After'], '600')

    def test_everything_runs_normally_when_switched_off(self):
        SiteSetting.objects.filter(key='maintenance_mode').update(value=False)

        self.assertNotEqual(self.client.get('/api/public/jobs/').status_code, 503)

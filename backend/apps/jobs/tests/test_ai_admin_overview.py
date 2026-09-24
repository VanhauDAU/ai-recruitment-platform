from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.sitecontent.models import SiteSetting


@override_settings(
    AI_RUNTIME_ENABLED=True,
    AI_PROVIDER_BACKEND='gemini_developer',
    AI_JOB_GENERATION_MODEL='gemini-3.5-flash-lite',
    AI_JOB_GENERATION_MODEL_ALLOWLIST=('gemini-3.5-flash-lite',),
    GEMINI_API_KEY='dashboard-test-secret',
)
class AdminAiOverviewTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='ai-overview-admin@example.com',
            password='Password@123',
        )
        SiteSetting.objects.update_or_create(
            key='ai_job_generation_enabled',
            defaults={
                'label': 'AI job generation',
                'group': SiteSetting.Group.AI,
                'value': True,
                'value_type': SiteSetting.ValueType.BOOLEAN,
            },
        )
        SiteSetting.objects.update_or_create(
            key='ai_job_generation_company_allowlist',
            defaults={
                'label': 'AI company allowlist',
                'group': SiteSetting.Group.AI,
                'value': ['cmp-sensitive'],
                'value_type': SiteSetting.ValueType.JSON,
            },
        )

    def test_superuser_gets_privacy_safe_7_and_30_day_overview(self):
        client = APIClient()
        client.force_authenticate(self.admin)

        response = client.get(reverse('admin-ai-overview'), {'days': 30})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.assertEqual(response.data['runtime']['status'], 'ready')
        self.assertEqual(response.data['queue']['name'], 'ai-generation')
        self.assertIn('days_7', response.data['usage'])
        self.assertIn('days_30', response.data['usage'])
        self.assertIn('days_30', response.data['generations'])
        self.assertTrue(response.data['runtime']['credential_configured'])
        self.assertNotIn('dashboard-test-secret', str(response.data))
        self.assertEqual(response.data['policy']['company_allowlist_count'], 1)
        self.assertNotIn('cmp-sensitive', str(response.data))

    def test_non_admin_cannot_read_operational_metrics(self):
        employer = User.objects.create_user(
            email='ai-overview-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        client = APIClient()
        client.force_authenticate(employer)

        response = client.get(reverse('admin-ai-overview'))

        self.assertEqual(response.status_code, 403)

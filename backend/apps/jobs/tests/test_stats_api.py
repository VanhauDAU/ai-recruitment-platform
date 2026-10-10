from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User


class JobStatsApiTests(APITestCase):
    def test_platform_account_totals_only_include_active_non_deleted_accounts(self):
        User.objects.create_user(
            email='active-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        User.objects.create_user(
            email='deleted-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            is_deleted=True,
        )
        User.objects.create_user(
            email='active-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        User.objects.create_user(
            email='inactive-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            is_active=False,
            status=User.Status.INACTIVE,
        )

        response = self.client.get(reverse('job-stats'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['candidates'], 1)
        self.assertEqual(response.data['employers'], 1)

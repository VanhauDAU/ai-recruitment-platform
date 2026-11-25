from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.tests.factories import make_admin

from ..models import Industry


class AdminIndustryApiTests(APITestCase):
    def test_hidden_industry_leaves_the_company_picker(self):
        self.client.force_authenticate(make_admin())
        fintech = Industry.objects.create(name='Lĩnh vực thử ẩn')
        Industry.objects.create(name='Lĩnh vực thử hiện')

        response = self.client.patch(
            reverse('admin-industry-detail', args=[fintech.pk]), {'is_active': False}, format='json'
        )
        self.client.force_authenticate(None)
        picker = self.client.get(reverse('employer-industries-all'))

        self.assertEqual(response.status_code, 200)
        names = [row['name'] for row in picker.data]
        self.assertIn('Lĩnh vực thử hiện', names)
        self.assertNotIn('Lĩnh vực thử ẩn', names)

    def test_creates_an_industry_with_its_own_slug(self):
        self.client.force_authenticate(make_admin())
        Industry.objects.create(name='Lĩnh vực thử')

        response = self.client.post(
            reverse('admin-industry-list'), {'name': 'Lĩnh vực thử!'}, format='json'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Industry.objects.get(pk=response.data['id']).slug, 'linh-vuc-thu-2')

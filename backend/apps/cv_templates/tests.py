from django.test import TestCase
from rest_framework.test import APIClient

from .models import CvTemplate


class PublicCvTemplateApiTests(TestCase):
    def test_public_selector_excludes_inactive_templates(self):
        CvTemplate.objects.create(name='Active template')
        CvTemplate.objects.create(name='Inactive template', status=CvTemplate.Status.INACTIVE)

        response = APIClient().get('/api/cv-templates/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'Active template')

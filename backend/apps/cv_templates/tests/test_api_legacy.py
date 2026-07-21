from django.test import TestCase
from rest_framework.test import APIClient

from ..models import CvTemplate
from ..renderers import validate_renderer_contract


class PublicCvTemplateApiTests(TestCase):
    def test_public_selector_excludes_inactive_templates(self):
        CvTemplate.objects.create(name='Active template')
        CvTemplate.objects.create(name='Inactive template', status=CvTemplate.Status.INACTIVE)

        response = APIClient().get('/api/cv-templates/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'Active template')

    def test_renderer_contract_accepts_deployed_keys_only(self):
        contract = validate_renderer_contract('classic_two_column_v1', 1, ['main', 'sidebar'])

        self.assertEqual(contract.version, '1')
        with self.assertRaisesMessage(Exception, 'Unsupported renderer'):
            validate_renderer_contract('template_42_component', 1, ['main'])

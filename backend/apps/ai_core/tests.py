from django.test import TestCase
from unittest.mock import patch

from .cv_import import structure_cv_text


class CvImportStructuringTests(TestCase):
    @patch('apps.ai_core.cv_import._call_provider')
    def test_provider_schema_is_retried_once_then_mapped_to_canonical(self, provider):
        provider.side_effect = [
            {'personal_info': {}, 'experiences': 'invalid'},
            {
                'personal_info': {
                    'full_name': 'Parsed Person', 'headline': 'Engineer',
                    'email': 'parsed@example.com', 'phone': '', 'address': '', 'links': [],
                },
                'summary': 'Builds reliable products.',
                'experiences': [], 'education': [], 'skills': ['Python'], 'projects': [],
            },
        ]

        content = structure_cv_text('candidate source text', 'en-US')

        self.assertEqual(provider.call_count, 2)
        self.assertEqual(content['personal_info']['full_name'], 'Parsed Person')
        self.assertEqual(content['sections'][0]['section_key'], 'summary')
        self.assertEqual(content['sections'][1]['items'][0]['name'], 'Python')

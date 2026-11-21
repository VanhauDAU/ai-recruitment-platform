from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase, override_settings

from apps.sitecontent.models import SiteSetting

from ..services.contracts import AiGenerationError
from ..services.cv_import import AiCvParseError, structure_cv_text

PARSED = {
    'personal_info': {
        'full_name': 'Parsed Person',
        'headline': 'Engineer',
        'email': 'parsed@example.com',
        'phone': '',
        'address': '',
        'links': [],
    },
    'summary': 'Builds reliable products.',
    'experiences': [],
    'education': [],
    'skills': ['Python'],
}
SOURCE = 'Nguyen Van A\nnguyen@example.com\nBackend developer'


@patch('apps.ai_core.services.cv_import.generate_structured')
class CvImportStructuringTests(TestCase):
    def test_uses_the_shared_runtime_and_maps_to_canonical_content(self, generate):
        generate.return_value = SimpleNamespace(data=PARSED)

        content = structure_cv_text(SOURCE, 'en-US')

        kwargs = generate.call_args.kwargs
        self.assertEqual(kwargs['use_case'], 'cv_import_structuring')
        self.assertTrue(callable(kwargs['result_validator']))
        self.assertEqual(content['personal_info']['full_name'], 'Parsed Person')
        self.assertEqual(content['sections'][1]['items'][0]['name'], 'Python')

    @override_settings(AI_CV_IMPORT_MODEL='cv-model', AI_JOB_GENERATION_MODEL='job-model')
    def test_prefers_the_dedicated_cv_import_model(self, generate):
        generate.return_value = SimpleNamespace(data=PARSED)

        structure_cv_text(SOURCE, 'vi-VN')

        self.assertEqual(generate.call_args.kwargs['model'], 'cv-model')

    def test_unavailable_runtime_falls_back_to_rule_based_parsing(self, generate):
        generate.side_effect = AiGenerationError('provider_not_configured')

        content = structure_cv_text(SOURCE, 'vi-VN')

        self.assertEqual(content['personal_info']['full_name'], 'Nguyen Van A')
        self.assertEqual(content['personal_info']['email'], 'nguyen@example.com')

    def test_admin_switch_skips_ai_entirely(self, generate):
        SiteSetting.objects.update_or_create(
            key='ai_enabled', defaults={'value': False, 'value_type': SiteSetting.ValueType.BOOLEAN}
        )

        content = structure_cv_text(SOURCE, 'vi-VN')

        generate.assert_not_called()
        self.assertEqual(content['personal_info']['full_name'], 'Nguyen Van A')

    def test_provider_failure_after_runtime_retries_is_reported(self, generate):
        generate.side_effect = AiGenerationError('provider_unavailable', retryable=True)

        with self.assertRaisesRegex(AiCvParseError, 'ai_provider_failed'):
            structure_cv_text(SOURCE, 'vi-VN')

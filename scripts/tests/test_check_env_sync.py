import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from check_env_sync import (  # noqa: E402
    local_env_report,
    normalized_value,
)


class EnvCatalogValidationTests(TestCase):
    def test_supported_casts_reject_invalid_values(self):
        self.assertIs(normalized_value('true', 'bool'), True)
        self.assertEqual(normalized_value('17', 'int'), 17)
        self.assertEqual(normalized_value('a, b', 'Csv'), ['a', 'b'])

        with self.assertRaises(ValueError):
            normalized_value('not-a-boolean', 'bool')

    def test_local_report_lists_names_without_values(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            secret_value = 'must-never-appear-in-output'
            path.write_text(
                'REQUIRED=\n'
                f'UNKNOWN={secret_value}\n'
                'RETIRED=old-value\n'
                'DUPLICATE=first\n'
                'DUPLICATE=second\n',
                encoding='utf-8',
            )

            messages = local_env_report(
                'test/.env',
                path,
                {'REQUIRED', 'DUPLICATE'},
                {'REQUIRED'},
                {'RETIRED'},
            )

        rendered = '\n'.join(messages)
        self.assertIn('UNKNOWN', rendered)
        self.assertIn('RETIRED', rendered)
        self.assertIn('DUPLICATE', rendered)
        self.assertIn('REQUIRED', rendered)
        self.assertNotIn(secret_value, rendered)

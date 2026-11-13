import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from check_env_sync import ConfigContract, local_env_report, normalized_value  # noqa: E402
from sync_local_env import render  # noqa: E402


class EnvTemplateValidationTests(TestCase):
    def test_supported_casts_reject_invalid_values(self):
        self.assertIs(normalized_value('true', 'bool'), True)
        self.assertEqual(normalized_value('17', 'int'), 17)
        self.assertEqual(normalized_value('a, b', 'Csv'), ['a', 'b'])

        with self.assertRaises(ValueError):
            normalized_value('not-a-boolean', 'bool')
        with self.assertRaises(ValueError):
            normalized_value('', 'int')

    def test_local_report_lists_names_without_values(self):
        secret_value = 'must-never-appear-in-output'
        with TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text(
                f'UNKNOWN={secret_value}\nDUPLICATE=first\nDUPLICATE=second\nNUMBER=\n',
                encoding='utf-8',
            )
            contracts = {'NUMBER': [ConfigContract(Path('base.py'), 1, 'int', 0)]}
            rendered = '\n'.join(
                local_env_report(path, ['MISSING', 'DUPLICATE', 'NUMBER'], contracts)
            )

        for name in ('MISSING', 'UNKNOWN', 'DUPLICATE', 'NUMBER'):
            self.assertIn(name, rendered)
        self.assertNotIn(secret_value, rendered)


class SyncLocalEnvTests(TestCase):
    def test_render_keeps_local_values_and_template_layout(self):
        template = '# Section\nKEPT=default\nADDED=template\n'
        rendered = render(template, {'KEPT': 'local', 'DROPPED': 'gone'})

        self.assertEqual(rendered, '# Section\nKEPT=local\nADDED=template\n')

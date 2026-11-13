import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from decouple import AutoConfig

from config.env import build_config


class BackendEnvLoaderTests(TestCase):
    def test_process_environment_takes_precedence_over_backend_env_file(self):
        with TemporaryDirectory() as directory:
            env_file = Path(directory) / '.env'
            env_file.write_text('PROCV_TEST_VALUE=from-file\n', encoding='utf-8')

            with patch.dict(os.environ, {'PROCV_TEST_VALUE': 'from-process'}, clear=False):
                value = build_config(env_file)('PROCV_TEST_VALUE')

        self.assertEqual(value, 'from-process')

    def test_loader_does_not_walk_up_to_repository_level_env(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.env').write_text('PROCV_TEST_VALUE=wrong-root\n', encoding='utf-8')
            backend = root / 'backend'
            backend.mkdir()

            with patch.dict(os.environ, {}, clear=True):
                value = build_config(backend / '.env')('PROCV_TEST_VALUE', default='fallback')

        self.assertEqual(value, 'fallback')

    def test_optional_catalog_is_never_loaded_automatically(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            env_file = root / '.env'
            env_file.write_text('PROCV_MINIMAL_VALUE=loaded\n', encoding='utf-8')
            (root / '.env.optional.example').write_text(
                'PROCV_OPTIONAL_VALUE=must-not-load\n',
                encoding='utf-8',
            )

            with patch.dict(os.environ, {}, clear=True):
                resolver = build_config(env_file)
                minimal = resolver('PROCV_MINIMAL_VALUE')
                optional = resolver('PROCV_OPTIONAL_VALUE', default='fallback')

        self.assertEqual(minimal, 'loaded')
        self.assertEqual(optional, 'fallback')

    def test_explicit_loader_preserves_legacy_values_and_casts_for_backend_env(self):
        with TemporaryDirectory() as directory:
            backend = Path(directory) / 'backend'
            backend.mkdir()
            env_file = backend / '.env'
            env_file.write_text(
                'PROCV_TEXT=same-value\nPROCV_BOOL=true\nPROCV_NUMBER=17\n',
                encoding='utf-8',
            )

            with patch.dict(os.environ, {}, clear=True):
                legacy = AutoConfig(search_path=backend)
                explicit = build_config(env_file)
                legacy_values = (
                    legacy('PROCV_TEXT'),
                    legacy('PROCV_BOOL', cast=bool),
                    legacy('PROCV_NUMBER', cast=int),
                )
                explicit_values = (
                    explicit('PROCV_TEXT'),
                    explicit('PROCV_BOOL', cast=bool),
                    explicit('PROCV_NUMBER', cast=int),
                )

        self.assertEqual(explicit_values, legacy_values)

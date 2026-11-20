"""Hợp đồng cấu hình (ADR-0026): seed ``settings.json`` và code phải khớp nhau.

Mỗi key trong seed phải có code đọc thật, mỗi key code đọc phải có trong seed,
và metadata của key phải dựng được trang quản trị. Test này chặn việc quay lại
tình trạng trang cấu hình hiển thị công tắc không điều khiển gì.
"""

import importlib
import re
from pathlib import Path

from django.test import SimpleTestCase

from ..models import SiteSetting
from ..selectors import setting_registry
from ..services.site_settings import _validate_value

BACKEND_DIR = Path(__file__).resolve().parents[3]
FRONTEND_SRC = BACKEND_DIR.parent / 'frontend' / 'src'
FRONTEND_PUBLIC = BACKEND_DIR.parent / 'frontend' / 'public'

# Key đã lên lịch nối vào code ở giai đoạn sau của kế hoạch
# docs/01-phan-tich/ke-hoach-cau-hinh-he-thong.md (GĐ3/GĐ4). Seed đánh dấu
# chúng bằng options.pending và mô tả "Chưa có hiệu lực"; danh sách chỉ được
# thu hẹp — key mới phải có consumer ngay khi thêm vào seed.
PENDING_CONSUMERS = {
    'maintenance_mode',
    'maintenance_message',
    'home_show_banner',
    'home_show_stats',
    'home_show_categories',
    'home_show_featured_jobs',
    'home_featured_jobs_count',
    'home_show_cv_templates',
    'candidate_allow_registration',
    'employer_allow_registration',
    'email_welcome_enabled',
}

_BACKEND_READ = re.compile(r"get_(?:string_|int_|bool_)?setting\(\s*['\"]([a-z0-9_]+)['\"]")
_FRONTEND_READ = re.compile(r"useSiteSetting\(\s*['\"]([a-z0-9_]+)['\"]")


def _is_test_path(path):
    return 'tests' in path.parts or '__tests__' in path.parts or '.test.' in path.name


def _backend_sources():
    for path in (BACKEND_DIR / 'apps').rglob('*'):
        if path.suffix not in {'.py', '.html', '.txt'} or _is_test_path(path):
            continue
        if 'migrations' in path.parts or 'seed_data' in path.parts:
            continue
        yield path


def _frontend_sources():
    for path in FRONTEND_SRC.rglob('*'):
        if path.suffix in {'.js', '.jsx'} and not _is_test_path(path):
            yield path


def _read_all(paths):
    return {path: path.read_text(encoding='utf-8') for path in paths}


class SettingsContractTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.registry = setting_registry()
        cls.backend = _read_all(_backend_sources())
        cls.frontend = _read_all(_frontend_sources())

    def test_frontend_sources_are_available(self):
        self.assertTrue(self.frontend, f'Không tìm thấy mã nguồn frontend ở {FRONTEND_SRC}')

    def test_every_seeded_key_has_a_consumer(self):
        corpus = '\n'.join([*self.backend.values(), *self.frontend.values()])
        dead = sorted(
            key
            for key in self.registry
            if key not in PENDING_CONSUMERS and not re.search(rf'\b{key}\b', corpus)
        )

        self.assertEqual(dead, [], 'Key trong seed không có code nào đọc')

    def test_pending_keys_are_flagged_in_seed(self):
        flagged = {key for key, row in self.registry.items() if row['options'].get('pending')}

        self.assertEqual(flagged, PENDING_CONSUMERS)

    def test_every_key_read_by_code_is_seeded(self):
        read = set()
        for text in self.backend.values():
            read.update(_BACKEND_READ.findall(text))
        for text in self.frontend.values():
            read.update(_FRONTEND_READ.findall(text))

        self.assertEqual(sorted(read - set(self.registry)), [])

    def test_removed_keys_never_come_back(self):
        migration = importlib.import_module(
            'apps.sitecontent.migrations.0004_settings_contract_data'
        )

        self.assertEqual(sorted(set(migration.REMOVED_KEYS) & set(self.registry)), [])

    def test_metadata_builds_the_admin_page(self):
        groups = set(SiteSetting.Group.values)
        for key, row in self.registry.items():
            with self.subTest(key=key):
                self.assertIn(row['group'], groups)
                self.assertTrue(row['section'].strip())
                self.assertTrue(row['description'].strip())
                self.assertLessEqual(len(row['description']), 300)
                self.assertIn(row['value_type'], SiteSetting.ValueType.values)
                depends_on = row['options'].get('depends_on')
                if depends_on:
                    self.assertIn(depends_on, self.registry)

    def test_every_default_passes_validation(self):
        for key, row in self.registry.items():
            setting = SiteSetting(key=key, value_type=row['value_type'], options=row['options'])
            with self.subTest(key=key):
                self.assertIsNone(_validate_value(setting, row['value'])[1])

    def test_bundled_image_defaults_exist(self):
        for key, row in self.registry.items():
            value = row['value']
            if row['value_type'] != 'image' or not str(value).startswith('/'):
                continue
            with self.subTest(key=key):
                self.assertTrue((FRONTEND_PUBLIC / value.lstrip('/')).is_file(), value)

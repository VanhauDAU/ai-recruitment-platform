from io import StringIO
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase

from common.storage.media import public_media_storage

from ..management.commands.seed_job_categories import GROUP_ICON_STORAGE_DIR, GROUP_ICONS
from ..models import JobCategory


class SeedJobCategoryIconTests(TestCase):
    def setUp(self):
        self.storage = public_media_storage()
        self.addCleanup(self._remove_default_icons)

    def _remove_default_icons(self):
        for stem in GROUP_ICONS.values():
            key = f'{GROUP_ICON_STORAGE_DIR}/default-{stem}.webp'
            if self.storage.exists(key):
                self.storage.delete(key)

    def test_groups_get_default_icons_without_overwriting_admin_logos(self):
        admin_logo = self.storage.save('jobs/categories/logos/admin.png', ContentFile(b'logo'))
        self.addCleanup(self.storage.delete, admin_logo)
        JobCategory.objects.create(name='Kế toán/Kiểm toán/Thuế', logo_url=admin_logo)

        call_command('seed_job_categories', stdout=StringIO())
        call_command('seed_job_categories', stdout=StringIO())  # chạy lại: không tạo file trùng

        groups = dict(
            JobCategory.objects.filter(parent__isnull=True).values_list('name', 'logo_url')
        )
        self.assertEqual(groups['Kế toán/Kiểm toán/Thuế'], admin_logo)
        self.assertEqual(
            groups['Công nghệ thông tin'], f'{GROUP_ICON_STORAGE_DIR}/default-laptop.webp'
        )
        self.assertTrue(self.storage.exists(groups['Công nghệ thông tin']))
        self.assertEqual(set(GROUP_ICONS), set(groups))
        _, files = self.storage.listdir(GROUP_ICON_STORAGE_DIR)
        self.assertEqual(
            sorted(name for name in files if name.startswith('default-')),
            sorted(
                f'default-{stem}.webp'
                for name, stem in GROUP_ICONS.items()
                if name != 'Kế toán/Kiểm toán/Thuế'
            ),
        )

    def test_uploaded_icons_are_tagged_as_webp(self):
        # R2 lưu theo content_type này; thiếu thì ảnh thành application/octet-stream.
        storage_class = type(self.storage)
        with patch.object(
            storage_class, 'save', autospec=True, side_effect=storage_class.save
        ) as save:
            call_command('seed_job_categories', stdout=StringIO())

        content_types = [call.args[2].content_type for call in save.call_args_list]
        self.assertEqual(content_types, ['image/webp'] * len(GROUP_ICONS))

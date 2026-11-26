from django.test import SimpleTestCase

from ..selectors.legacy_paths import modernize_path_prefix


class ModernizePathPrefixTests(SimpleTestCase):
    def test_translates_portal_prefixes_and_keeps_tail(self):
        cases = {
            '/tuyendung/app/dashboard': '/tuyendung/app/tong-quan',
            '/tuyendung/app/account/settings/gpkd': '/tuyendung/app/cai-dat/giay-phep-kinh-doanh',
            '/tuyendung/app/jobs/jb_1': '/tuyendung/app/tin-tuyen-dung/jb_1',
            '/quan-tri/accounts': '/quan-tri/tai-khoan',
            '/quan-tri/account': '/quan-tri/tai-khoan-cua-toi',
            '/admin/app': '/quan-tri',
            '/admin/app/tai-khoan': '/quan-tri/tai-khoan',
            '/admin/app/accounts': '/quan-tri/tai-khoan',
            '/sign-up': '/dang-ky',
        }
        for old, new in cases.items():
            with self.subTest(old=old):
                self.assertEqual(modernize_path_prefix(old), new)

    def test_leaves_current_and_unknown_paths_untouched(self):
        untouched = (
            '/viec-lam',
            '/tuyendung',
            '/tuyendung/app/tong-quan',
            '/quan-tri/accountsx',
            '/admin/application',
        )
        for path in untouched:
            with self.subTest(path=path):
                self.assertEqual(modernize_path_prefix(path), path)

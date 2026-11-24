"""Mã hiển thị dùng chung (common.db.readable_code)."""

import re
from unittest.mock import patch

from django.test import SimpleTestCase

from common.db.readable_code import code_search_q, random_readable_code, readable_code_regex


class ReadableCodeTests(SimpleTestCase):
    def test_code_keeps_its_length_and_never_starts_with_zero(self):
        with patch('common.db.readable_code.secrets.randbelow', side_effect=[0, 9 * 10**6 - 1]):
            self.assertEqual(random_readable_code(7, 'J'), 'J1000000')
            self.assertEqual(random_readable_code(7, 'J'), 'J9999999')

        pattern = re.compile(readable_code_regex(7, 'J'))
        self.assertTrue(pattern.match('J1000000'))
        for bad in ('J0123456', 'j1234567', 'J123456', 'X1234567'):
            self.assertFalse(pattern.match(bad), bad)

    def test_search_ignores_separators_and_blank_queries(self):
        self.assertEqual(code_search_q('code', ' j 482-91.73 #'), code_search_q('code', 'j4829173'))
        self.assertEqual(str(code_search_q('code', ' - ')), str(code_search_q('code', '')))

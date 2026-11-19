from django.test import SimpleTestCase

from common.api.params import parse_bool, parse_int


class ParseBoolTests(SimpleTestCase):
    def test_recognised_values(self):
        for value in ('1', 'true', 'TRUE', ' yes ', 'on', True):
            self.assertIs(parse_bool(value), True, value)
        for value in ('0', 'false', 'No', 'off', False):
            self.assertIs(parse_bool(value), False, value)

    def test_missing_or_unknown_values_use_the_default(self):
        self.assertIsNone(parse_bool(None))
        self.assertIsNone(parse_bool('maybe'))
        self.assertIs(parse_bool('', default=False), False)


class ParseIntTests(SimpleTestCase):
    def test_parses_and_clamps(self):
        self.assertEqual(parse_int(' 7 '), 7)
        self.assertEqual(parse_int('500', maximum=100), 100)
        self.assertEqual(parse_int('-3', minimum=1), 1)

    def test_invalid_values_use_the_default(self):
        self.assertIsNone(parse_int('abc'))
        self.assertEqual(parse_int(None, 20), 20)
        self.assertEqual(parse_int(True, 5), 5)

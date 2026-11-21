from django.test import SimpleTestCase

from ..models import SiteSetting
from ..services.site_settings import _validate_value


class NumericSiteSettingValidationTests(SimpleTestCase):
    def setUp(self):
        self.setting = SiteSetting(
            key='employer_badge_min_account_months',
            value_type=SiteSetting.ValueType.NUMBER,
            options={'integer': True, 'min': 1, 'max': 60, 'step': 1},
        )

    def test_accepts_integer_inside_declared_bounds(self):
        self.assertEqual(_validate_value(self.setting, 6), (6, None))

    def test_rejects_boolean_fraction_and_values_outside_bounds(self):
        for value in (True, 6.5, 0, 61, float('nan'), float('inf')):
            with self.subTest(value=value):
                normalized, error = _validate_value(self.setting, value)
                self.assertIsNone(normalized)
                self.assertTrue(error)


class TypedSiteSettingValidationTests(SimpleTestCase):
    def _setting(self, value_type, **options):
        return SiteSetting(key='k', value_type=value_type, options=options)

    def _error(self, setting, value):
        return _validate_value(setting, value)[1]

    def test_url_accepts_http_and_site_paths_and_blank(self):
        setting = self._setting(SiteSetting.ValueType.URL)
        for value in ('https://procv.vn/chinh-sach', '/chinh-sach-cookie', ''):
            with self.subTest(value=value):
                self.assertIsNone(self._error(setting, value))
        for value in ('javascript:alert(1)', 'procv.vn', 'ftp://x.vn/a'):
            with self.subTest(value=value):
                self.assertTrue(self._error(setting, value))

    def test_email_and_max_length(self):
        email = self._setting(SiteSetting.ValueType.EMAIL)
        self.assertIsNone(self._error(email, 'hotro@procv.vn'))
        self.assertTrue(self._error(email, 'hotro@'))
        text = self._setting(SiteSetting.ValueType.TEXT, max_length=5)
        self.assertIsNone(self._error(text, '12345'))
        self.assertEqual(self._error(text, '123456'), 'Tối đa 5 ký tự.')

    def test_json_schema_for_object_lists(self):
        setting = self._setting(
            SiteSetting.ValueType.JSON,
            schema={'item': 'object', 'fields': ['value', 'label_vi'], 'required': ['value']},
        )
        self.assertIsNone(self._error(setting, [{'value': '10+', 'label_vi': 'tin'}]))
        self.assertIsNone(self._error(setting, []))
        for value in (
            {'value': '1'},
            ['x'],
            [{'label_vi': 'thiếu value'}],
            [{'value': '1', 'x': 1}],
        ):
            with self.subTest(value=value):
                self.assertTrue(self._error(setting, value))

    def test_json_schema_for_string_lists_and_free_json(self):
        strings = self._setting(SiteSetting.ValueType.JSON, schema={'item': 'string'})
        self.assertIsNone(self._error(strings, ['gemini-3.5-flash-lite']))
        self.assertTrue(self._error(strings, ['', 'x']))
        self.assertIsNone(self._error(self._setting(SiteSetting.ValueType.JSON), {'free': 1}))


class MultiselectValidationTests(SimpleTestCase):
    def test_values_must_be_unique_known_choices(self):
        setting = SiteSetting(
            key='k',
            value_type=SiteSetting.ValueType.MULTISELECT,
            options={'choices': [{'value': 'a'}, {'value': 'b'}]},
        )
        self.assertEqual(_validate_value(setting, ['b', 'a']), (['b', 'a'], None))
        self.assertEqual(_validate_value(setting, []), ([], None))
        for value in (['c'], ['a', 'a'], 'a'):
            with self.subTest(value=value):
                self.assertTrue(_validate_value(setting, value)[1])


class IntegerListSettingValidationTests(SimpleTestCase):
    def test_integer_list_schema_accepts_ints_in_range_only(self):
        setting = SiteSetting(
            key='recruiter_reminder_days',
            value_type=SiteSetting.ValueType.JSON,
            options={'schema': {'item': 'integer', 'min': 1, 'max': 60}},
        )

        self.assertIsNone(_validate_value(setting, [3, 7])[1])
        for value in ([0], [61], ['3'], [True], [2.5], 3):
            with self.subTest(value=value):
                self.assertTrue(_validate_value(setting, value)[1])

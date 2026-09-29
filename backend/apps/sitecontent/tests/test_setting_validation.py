from django.test import SimpleTestCase

from ..api.views.settings import _validate_value
from ..models import SiteSetting


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

"""Between 00:00 and 07:00 in Vietnam the UTC date is still yesterday.

These checks pin call sites that used to read ``timezone.localdate()`` (UTC)
to the Vietnamese calendar.
"""

from datetime import UTC, date, datetime, timedelta
from unittest.mock import patch

from django.test import TestCase

from apps.ai_core.models import AiUsageDaily
from apps.ai_core.services.usage import record_ai_quota_rejection
from apps.employers.api.serializers.recruitment_need import RecruitmentNeedSerializer
from common.vietnam_time import vietnam_today

# 00:30 on 17 November in Vietnam; UTC still reads 16 November.
EARLY_MORNING_VN = datetime(2026, 11, 16, 17, 30, tzinfo=UTC)


@patch('django.utils.timezone.now', return_value=EARLY_MORNING_VN)
class VietnamDayBoundaryTests(TestCase):
    def test_today_is_the_vietnamese_date(self, _now):
        self.assertEqual(vietnam_today(), date(2026, 11, 17))

    def test_ai_usage_is_bucketed_on_the_vietnamese_day(self, _now):
        record_ai_quota_rejection(
            use_case='job_post_generation', provider='p', provider_backend='b', model='m'
        )

        self.assertEqual(AiUsageDaily.objects.get().date, date(2026, 11, 17))

    def test_a_target_date_of_yesterday_in_vietnam_is_in_the_past(self, _now):
        serializer = RecruitmentNeedSerializer(
            data={'target_date': (date(2026, 11, 17) - timedelta(days=1)).isoformat()},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('target_date', serializer.errors)

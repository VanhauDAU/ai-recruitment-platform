"""Dữ liệu matching dẫn xuất từ document CV (CVT-1c)."""

from datetime import date

from django.test import SimpleTestCase

from apps.jobs.models import Job

from ..services.matching_profile import experience_months, experience_years

TODAY = date(2026, 11, 14)


def content(*items, enabled=True):
    return {
        'sections': [
            {
                'instance_id': 'experience_1',
                'section_key': 'experience',
                'enabled': enabled,
                'items': [
                    {'item_id': f'item_{index}', 'start_date': start, 'end_date': end}
                    for index, (start, end) in enumerate(items)
                ],
            }
        ]
    }


class ExperienceYearsTests(SimpleTestCase):
    def test_overlapping_and_adjacent_ranges_are_merged(self):
        document = content(('2020-01', '2020-12'), ('2020-06', '2021-06'), ('2021-07', '2021-12'))

        self.assertEqual(experience_months(document, TODAY), 24)
        self.assertEqual(experience_years(document, TODAY), Job.ExperienceYears.TWO)

    def test_open_ended_role_counts_until_today(self):
        self.assertEqual(experience_months(content(('2026-01', None)), TODAY), 11)
        self.assertEqual(
            experience_years(content(('2026-01', None)), TODAY), Job.ExperienceYears.UNDER_1
        )

    def test_buckets_follow_the_job_vocabulary(self):
        self.assertEqual(experience_years({'sections': []}, TODAY), Job.ExperienceYears.NONE)
        self.assertEqual(
            experience_years(content(('2016-01', '2022-12')), TODAY), Job.ExperienceYears.OVER_5
        )
        self.assertEqual(
            experience_years(content(('2021-01', '2025-12')), TODAY), Job.ExperienceYears.FIVE
        )

    def test_invalid_future_and_disabled_entries_are_ignored(self):
        self.assertEqual(
            experience_months(
                content(
                    ('bad', None), ('2020-13', None), ('2027-01', None), ('2022-05', '2021-01')
                ),
                TODAY,
            ),
            0,
        )
        self.assertEqual(experience_months(content(('2020-01', None), enabled=False), TODAY), 0)

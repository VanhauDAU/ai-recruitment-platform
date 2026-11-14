"""Dữ liệu matching dẫn xuất từ document CV (CVT-1c, CVT-3)."""

from datetime import date

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase

from apps.jobs.models import Job
from apps.skills.models import Skill

from ..models import CvSkill, UserCv
from ..services.matching_profile import (
    declared_skills,
    education_level,
    experience_months,
    experience_years,
    sync_matching_profile,
)

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


def section(key, *items, enabled=True):
    return {'section_key': key, 'enabled': enabled, 'items': list(items)}


class EducationAndSkillsTests(SimpleTestCase):
    """CVT-3: bậc học và kỹ năng dùng cùng từ vựng với tin tuyển dụng."""

    def test_education_level_is_the_highest_declared_degree(self):
        document = {
            'sections': [
                section(
                    'education',
                    {'degree_level': Job.EducationLevel.COLLEGE},
                    {'degree_level': Job.EducationLevel.UNIVERSITY},
                    {'degree_level': 'not-a-level'},
                ),
                section(
                    'education', {'degree_level': Job.EducationLevel.POSTGRADUATE}, enabled=False
                ),
            ]
        }

        self.assertEqual(education_level(document), Job.EducationLevel.UNIVERSITY)
        self.assertEqual(education_level({'sections': []}), '')

    def test_declared_skills_merge_skill_items_and_skill_mapped_fields(self):
        document = {
            'sections': [
                section('skills', {'name': ' Python ', 'level': 4}, {'name': 'Giao tiếp'}),
                section(
                    'position_details',
                    {'maps_to': 'skills', 'value': ['Django', 'python']},
                    {'maps_to': 'none', 'value': ['Không phải kỹ năng']},
                ),
            ]
        }

        declared = declared_skills(document)

        self.assertEqual(declared['python'], (' Python ', CvSkill.Level.ADVANCED))
        self.assertEqual(declared['django'], ('Django', ''))
        self.assertIn('giao tiếp', declared)
        self.assertNotIn('không phải kỹ năng', declared)


class CvSkillSyncTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            email='matching-candidate@example.com', password='password', role='candidate'
        )
        self.cv = UserCv.objects.create(
            user=user, cv_type=UserCv.CvType.BUILDER, source=UserCv.Source.BUILDER, title='CV'
        )
        self.python = Skill.objects.create(name='Python')
        self.react = Skill.objects.create(name='React', aliases=['ReactJS'])

    def document(self, *skills):
        return {'sections': [section('skills', *skills)]}

    def test_known_skills_are_linked_by_name_or_alias_and_unknown_are_skipped(self):
        sync_matching_profile(
            self.cv,
            self.document({'name': 'python', 'level': 2}, {'name': 'ReactJS'}, {'name': 'Bơi lội'}),
        )

        rows = {row.skill.name: row.level for row in self.cv.cv_skills.select_related('skill')}
        self.assertEqual(rows, {'Python': CvSkill.Level.BEGINNER, 'React': ''})
        self.assertFalse(Skill.objects.filter(normalized_name='bơi lội').exists())

    def test_resync_updates_levels_and_removes_dropped_skills(self):
        sync_matching_profile(self.cv, self.document({'name': 'Python'}, {'name': 'React'}))
        sync_matching_profile(self.cv, self.document({'name': 'Python', 'level': 5}))

        rows = {row.skill.name: row.level for row in self.cv.cv_skills.select_related('skill')}
        self.assertEqual(rows, {'Python': CvSkill.Level.ADVANCED})

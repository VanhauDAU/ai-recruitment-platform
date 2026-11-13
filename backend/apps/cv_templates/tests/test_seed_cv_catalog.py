"""`seed_cv_catalog` dựng hồ sơ vị trí và nội dung mẫu đủ mọi nhóm kinh nghiệm."""

from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.jobs.models import JobCategory, JobCategoryLocalization

from ..management.commands.seed_cv_catalog import SKILLS_FIRST_PRESET
from ..models import CATALOG_LANGUAGES, CvPositionProfile, CvSampleContent, ExperienceBand


class SeedCvCatalogTests(TestCase):
    def setUp(self):
        self.backend = JobCategory.objects.create(
            name='Backend Developer',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        JobCategoryLocalization.objects.create(
            category=self.backend, locale='en-US', display_name='Backend Developer'
        )

    def run_seed(self):
        call_command('seed_cv_catalog', stdout=StringIO())

    def test_generic_content_covers_every_language_and_band(self):
        self.run_seed()

        generic = CvSampleContent.objects.filter(position_profile__isnull=True)
        self.assertEqual(
            set(generic.values_list('locale', 'experience_band')),
            {(language.code, band) for language in CATALOG_LANGUAGES for band in ExperienceBand},
        )
        self.assertTrue(all('{position}' in str(sample.content_json) for sample in generic))

    def test_positions_get_profiles_presets_and_localized_curated_content(self):
        self.run_seed()

        profile = CvPositionProfile.objects.get(job_category=self.backend)
        self.assertEqual(profile.section_preset, SKILLS_FIRST_PRESET)
        curated = CvSampleContent.objects.filter(position_profile=profile)
        self.assertEqual(curated.count(), len(CATALOG_LANGUAGES))
        self.assertTrue(all('{position}' not in str(sample.content_json) for sample in curated))

    def test_rerunning_keeps_rows_and_admin_presets(self):
        self.run_seed()
        profile = CvPositionProfile.objects.get(job_category=self.backend)
        custom = [{'section_key': 'summary', 'enabled': True}]
        profile.section_preset = custom
        profile.save(update_fields=['section_preset'])
        counts = (CvPositionProfile.objects.count(), CvSampleContent.objects.count())

        self.run_seed()

        profile.refresh_from_db()
        self.assertEqual(profile.section_preset, custom)
        self.assertEqual(
            counts, (CvPositionProfile.objects.count(), CvSampleContent.objects.count())
        )

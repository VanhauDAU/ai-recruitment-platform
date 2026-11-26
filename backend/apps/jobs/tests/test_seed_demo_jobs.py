from io import StringIO

from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse

from apps.employers.models import Company
from apps.locations.models import Location

from ..models import Job
from ..models.core import validate_application_reasons
from ..seed_data.demo_job_catalog import CATALOG_JOBS, CATALOG_SCHEDULES, COMPANY_PERKS
from ..seed_data.demo_jobs import COMPANIES, JOBS_BY_CATEGORY


class SeedDemoJobsTests(TestCase):
    def setUp(self):
        province = Location.objects.create(
            code='01',
            level=Location.Level.PROVINCE,
            name='Thành phố Hà Nội',
        )
        Location.objects.create(
            code='00001',
            level=Location.Level.WARD,
            name='Phường Ba Đình',
            parent=province,
        )

    def test_seeded_companies_are_featured_and_indexable(self):
        cache.clear()
        call_command('seed_demo_jobs', stdout=StringIO())

        hiring_company_ids = set(
            Job.publicly_available_queryset().values_list('company__public_id', flat=True)
        )
        featured = self.client.get(reverse('public-company-list'))
        sitemap = self.client.get(reverse('seo-sitemap-companies'))

        self.assertTrue(hiring_company_ids)
        self.assertSetEqual(
            {item['public_id'] for item in featured.data['results']},
            hiring_company_ids,
        )
        self.assertTrue(all(item['logo_url'] for item in featured.data['results']))
        self.assertEqual(Company.objects.count(), 8)
        for slug in Company.objects.values_list('slug', flat=True):
            self.assertContains(sitemap, f'/cong-ty/{slug}<')

    def test_catalog_only_refreshes_catalog_and_keeps_other_jobs(self):
        call_command('seed_demo_jobs', stdout=StringIO())
        other = Job.objects.exclude(title__in=[spec['title'] for spec in CATALOG_JOBS]).first()
        total = Job.objects.count()

        call_command('seed_demo_jobs', catalog_only=True, stdout=StringIO())

        self.assertEqual(Job.objects.count(), total)
        self.assertTrue(Job.objects.filter(pk=other.pk).exists())
        job = Job.objects.get(title='Kỹ sư NLP / LLM (Zalo AI)')
        self.assertEqual((job.currency, job.salary_min, job.salary_max), ('USD', 2500, 4000))
        self.assertEqual(job.company.company_name, 'VNG Corporation')
        self.assertIn('<li>', job.requirements)
        # Tin ở TP.HCM không có phường trong DB test -> bỏ qua, tin Hà Nội có địa điểm.
        self.assertFalse(job.job_locations.exists())
        hanoi_job = Job.objects.get(title='Kỹ sư AI thị giác máy tính (Camera AI)')
        self.assertEqual(hanoi_job.job_locations.get().location.name, 'Phường Ba Đình')

    def test_catalog_only_requires_seeded_companies(self):
        with self.assertRaises(CommandError):
            call_command('seed_demo_jobs', catalog_only=True, stdout=StringIO())


class DemoJobCatalogDataTests(SimpleTestCase):
    def test_catalog_values_match_model_choices(self):
        base_titles = {title for titles in JOBS_BY_CATEGORY.values() for title in titles}
        titles = [spec['title'] for spec in CATALOG_JOBS]
        self.assertEqual(len(titles), 100)
        self.assertEqual(len(set(titles)), 100)
        self.assertFalse(base_titles & set(titles))
        self.assertEqual(set(COMPANY_PERKS), set(range(len(COMPANIES))))
        salary_arity = {'range': 2, 'from': 1, 'up_to': 1, 'fixed': 1, 'negotiable': 0}
        for spec in CATALOG_JOBS:
            with self.subTest(spec['title']):
                kind, *amounts = spec['salary']
                self.assertEqual(len(amounts), salary_arity[kind])
                self.assertEqual(amounts, sorted(amounts))
                self.assertIn(spec['company'], COMPANY_PERKS)
                self.assertIn(spec.get('schedule', 'office'), CATALOG_SCHEDULES)
                self.assertIn(spec['experience'], Job.ExperienceYears.values)
                self.assertIn(spec.get('level', 'employee'), Job.PositionLevel.values)
                self.assertIn(spec.get('employment', 'full_time'), Job.EmploymentType.values)
                self.assertIn(spec.get('education', 'university'), Job.EducationLevel.values)
                self.assertTrue(set(spec.get('work', ['onsite'])) <= set(Job.WorkType.values))
                self.assertFalse(set(spec['skills']) & set(spec.get('preferred_skills', [])))
                validate_application_reasons(spec.get('reasons', []))


class SeedDemoJobsProductionGuardTests(TestCase):
    @override_settings(IS_PRODUCTION=True)
    def test_refuses_to_seed_on_production_but_still_clears(self):
        with self.assertRaises(CommandError):
            call_command('seed_demo_jobs', stdout=StringIO())

        call_command('seed_demo_jobs', clear=True, stdout=StringIO())
        self.assertFalse(Job.objects.exists())

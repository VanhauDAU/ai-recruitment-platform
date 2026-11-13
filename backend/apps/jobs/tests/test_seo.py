from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.accounts.models import User
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job

SHELL = (
    '<!doctype html><html lang="en"><head><title data-seo-default>Old</title>'
    '</head><body><div id="root"></div></body></html>'
)


@override_settings(FRONTEND_SHELL_HTML=SHELL)
class JobSeoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        employer = User.objects.create_user(
            email='seo-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        cls.company = Company.objects.create(
            company_name='Công ty SEO',
            website_url='https://company.example',
            created_by=employer,
        )
        make_employer_ready(employer, company=cls.company, candidate_data=True)
        cls.job = Job.objects.create(
            posted_by=employer,
            company=cls.company,
            title='Kỹ sư Backend',
            description='<p>Xây dựng hệ thống & an toàn.</p>',
            employment_type=Job.EmploymentType.FULL_TIME,
            salary_type=Job.SalaryType.RANGE,
            salary_min=20_000_000,
            salary_max=30_000_000,
            status=Job.Status.ACTIVE,
        )
        cls.closed_job = Job.objects.create(
            posted_by=employer,
            company=cls.company,
            title='Tin đã đóng',
            description='Không còn tuyển',
            status=Job.Status.CLOSED,
        )

    def setUp(self):
        cache.clear()

    def test_job_detail_has_canonical_and_job_posting(self):
        response = self.client.get(reverse('seo-job-detail', args=[self.job.slug]))
        html = response.content.decode()

        self.assertEqual(response.status_code, 200)
        self.assertIn(f'http://testserver/viec-lam/{self.job.slug}', html)
        self.assertIn('"@type":"JobPosting"', html)
        self.assertIn('"employmentType":"FULL_TIME"', html)
        self.assertIn('"minValue":20000000.0', html)
        self.assertNotIn('& an toàn', html)

    def test_brand_alias_points_to_regular_job_canonical(self):
        response = self.client.get(
            reverse('seo-job-detail-brand', args=[self.company.slug, self.job.slug])
        )

        self.assertContains(
            response,
            f'rel="canonical" href="http://testserver/viec-lam/{self.job.slug}"',
        )

    def test_unavailable_job_is_real_noindex_404_and_absent_from_sitemap(self):
        detail = self.client.get(reverse('seo-job-detail', args=[self.closed_job.slug]))
        sitemap = self.client.get(reverse('seo-sitemap-jobs'))

        self.assertEqual(detail.status_code, 404)
        self.assertEqual(detail['X-Robots-Tag'], 'noindex, nofollow')
        self.assertNotContains(sitemap, self.closed_job.slug)
        self.assertContains(sitemap, self.job.slug)

    def test_unknown_location_is_real_noindex_404(self):
        response = self.client.get('/viec-lam/tai/khong-ton-tai')

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')

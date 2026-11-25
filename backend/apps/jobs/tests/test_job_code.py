"""Mã tin tuyển dụng (`Job.code`): sinh mã, ràng buộc DB, migration và tìm kiếm."""

import re
from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase

from apps.employers.tests.factories import make_company, make_employer, publish_job
from common.tests.migration_case import drop_not_null, run_data_migration

from ..domain.job_code import JOB_CODE_REGEX
from ..models import Job
from ..selectors import admin_job_management_queryset, employer_job_list_queryset

CODE = re.compile(JOB_CODE_REGEX)


class JobCodeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.employer = make_employer('job-code@example.com')
        cls.company = make_company(cls.employer, name='Công ty Mã Tin')

    def test_every_job_gets_a_short_readable_code(self):
        jobs = [publish_job(self.company, self.employer) for _ in range(3)]

        codes = [job.code for job in jobs]
        self.assertTrue(all(CODE.match(code) for code in codes), codes)
        self.assertEqual(len(set(codes)), len(codes))
        self.assertTrue(jobs[0].public_id.startswith('jb_'))

    def test_new_code_skips_codes_already_taken(self):
        taken = publish_job(self.company, self.employer)
        with patch('apps.jobs.models.core.random_job_code', side_effect=[taken.code, 'J2345678']):
            job = publish_job(self.company, self.employer)

        self.assertEqual(job.code, 'J2345678')

    def test_database_rejects_malformed_codes(self):
        job = publish_job(self.company, self.employer)

        with self.assertRaises(IntegrityError):
            Job.objects.filter(pk=job.pk).update(code='J0123456')

    def test_admin_and_employer_find_jobs_by_code_read_aloud(self):
        job = publish_job(self.company, self.employer)
        publish_job(self.company, self.employer)
        Job.objects.filter(pk=job.pk).update(code='J4829173')

        for query in ('J4829173', 'j 482 9173', '482-9173', '#J4829173'):
            found = admin_job_management_queryset(params={'q': query})
            self.assertEqual(list(found.values_list('pk', flat=True)), [job.pk], query)
            mine = employer_job_list_queryset(self.employer, q=query)
            self.assertEqual(list(mine.values_list('pk', flat=True)), [job.pk], query)


class JobCodeMigrationTests(TestCase):
    def test_existing_jobs_receive_distinct_codes_and_coded_jobs_keep_theirs(self):
        employer = make_employer('legacy-job@example.com')
        company = make_company(employer, name='Công ty cũ')
        kept = publish_job(company, employer, title='Tin đã có mã')
        Job.objects.filter(pk=kept.pk).update(code='J4829173')
        legacy = [publish_job(company, employer, title=f'Tin cũ {index}') for index in range(3)]
        drop_not_null(Job, 'code')
        Job.objects.filter(pk__in=[job.pk for job in legacy]).update(code=None)

        run_data_migration('apps.jobs.migrations.0003_job_code', 'assign_codes')

        codes = set(
            Job.objects.filter(pk__in=[job.pk for job in legacy]).values_list('code', flat=True)
        )
        self.assertEqual(len(codes), 3)
        self.assertTrue(all(CODE.match(code) for code in codes), codes)
        self.assertNotIn('J4829173', codes)
        self.assertEqual(Job.objects.get(pk=kept.pk).code, 'J4829173')

"""Mã công ty (`Company.code`): sinh mã, ràng buộc DB, migration và tìm kiếm admin."""

import re
from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase

from common.tests.migration_case import drop_not_null, run_data_migration

from ..domain.company_code import COMPANY_CODE_REGEX
from ..models import Company
from ..selectors import admin_companies_queryset
from .factories import make_company, make_employer

CODE = re.compile(COMPANY_CODE_REGEX)


class CompanyCodeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.employer = make_employer('company-code@example.com')

    def test_every_company_gets_a_short_readable_code(self):
        companies = [make_company(self.employer, name=f'Công ty {i}') for i in range(3)]

        codes = [company.code for company in companies]
        self.assertTrue(all(CODE.match(code) for code in codes), codes)
        self.assertEqual(len(set(codes)), len(codes))

    def test_new_code_skips_codes_already_taken(self):
        taken = make_company(self.employer, name='Đã có')
        with patch(
            'apps.employers.models.company.random_company_code',
            side_effect=[taken.code, 'C234567'],
        ):
            company = make_company(self.employer, name='Mới')

        self.assertEqual(company.code, 'C234567')

    def test_database_rejects_malformed_codes(self):
        company = make_company(self.employer, name='Sai mã')

        with self.assertRaises(IntegrityError):
            Company.objects.filter(pk=company.pk).update(code='CO12345')

    def test_admin_finds_company_by_code_read_aloud(self):
        company = make_company(self.employer, name='Cần tìm')
        make_company(self.employer, name='Khác')
        Company.objects.filter(pk=company.pk).update(code='C305812')

        for query in ('C305812', 'c 305 812', '305-812'):
            found = admin_companies_queryset(params={'q': query})
            self.assertEqual(list(found.values_list('pk', flat=True)), [company.pk], query)


class CompanyCodeMigrationTests(TestCase):
    def test_existing_companies_receive_distinct_codes_and_coded_ones_keep_theirs(self):
        employer = make_employer('legacy-company@example.com')
        kept = make_company(employer, name='Đã có mã')
        Company.objects.filter(pk=kept.pk).update(code='C305812')
        legacy = [make_company(employer, name=f'Công ty cũ {index}') for index in range(3)]
        drop_not_null(Company, 'code')
        Company.objects.filter(pk__in=[company.pk for company in legacy]).update(code=None)

        run_data_migration('apps.employers.migrations.0007_company_code', 'assign_codes')

        codes = set(
            Company.objects.filter(pk__in=[company.pk for company in legacy]).values_list(
                'code', flat=True
            )
        )
        self.assertEqual(len(codes), 3)
        self.assertTrue(all(CODE.match(code) for code in codes), codes)
        self.assertNotIn('C305812', codes)
        self.assertEqual(Company.objects.get(pk=kept.pk).code, 'C305812')

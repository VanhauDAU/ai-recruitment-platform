"""Mã công ty (`Company.code`): sinh mã, ràng buộc DB, migration và tìm kiếm admin."""

import re
from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase

from common.tests.migration_case import MigrationTestCase

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


class CompanyCodeMigrationTests(MigrationTestCase):
    before = [('employers', '0006_company_follow_notify_since')]
    after = [('employers', '0008_company_code_required')]

    def test_existing_companies_receive_distinct_codes(self):
        employer = make_employer('legacy-company@example.com')
        apps = self.migrate(self.before)
        OldCompany = apps.get_model('employers', 'Company')
        for index in range(3):
            OldCompany.objects.create(
                public_id=f'co_legacy{index}',
                slug=f'legacy-{index}',
                company_name=f'Công ty cũ {index}',
                created_by_id=employer.pk,
            )

        self.migrate(self.after)

        codes = set(Company.objects.values_list('code', flat=True))
        self.assertEqual(len(codes), 3)
        self.assertTrue(all(CODE.match(code) for code in codes), codes)

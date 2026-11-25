"""Mã tài khoản 8 chữ số (`User.public_id`) và migration đổi mã `usr_<hex>` cũ."""

import re
from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase

from common.tests.migration_case import MigrationTestCase

from ..domain.account_code import ACCOUNT_CODE_REGEX, random_account_code
from ..models import AdminAccessAuditLog, User
from ..selectors import accounts_queryset
from .factories import make_admin

CODE = re.compile(ACCOUNT_CODE_REGEX)


class AccountCodeTests(TestCase):
    def test_random_code_always_has_eight_digits_without_leading_zero(self):
        with patch(
            'apps.accounts.domain.account_code.secrets.randbelow', side_effect=[0, 9 * 10**7 - 1]
        ):
            self.assertEqual(random_account_code(), '10000000')
            self.assertEqual(random_account_code(), '99999999')

    def test_every_portal_account_gets_its_own_numeric_code(self):
        users = [
            User.objects.create_user('same@example.com', 'Password@123', role=role)
            for role in User.Role.values
        ]

        codes = [user.public_id for user in users]
        self.assertTrue(all(CODE.match(code) for code in codes), codes)
        self.assertEqual(len(set(codes)), len(codes))

    def test_new_code_skips_codes_already_taken(self):
        taken = User.objects.create_user('taken@example.com', 'Password@123')
        with patch(
            'apps.accounts.models.user.random_account_code',
            side_effect=[taken.public_id, '23456789'],
        ):
            user = User.objects.create_user('next@example.com', 'Password@123')

        self.assertEqual(user.public_id, '23456789')

    def test_new_code_gives_up_instead_of_looping_forever(self):
        taken = User.objects.create_user('taken@example.com', 'Password@123')
        with patch('apps.accounts.models.user.random_account_code', return_value=taken.public_id):
            with self.assertRaises(RuntimeError):
                User.objects.new_public_id()

    def test_database_rejects_non_numeric_codes(self):
        user = User.objects.create_user('legacy@example.com', 'Password@123')

        with self.assertRaises(IntegrityError):
            User.objects.filter(pk=user.pk).update(public_id='01234567')

    def test_admin_search_accepts_codes_read_out_in_groups(self):
        admin = make_admin(superuser=True)
        user = User.objects.create_user('caller@example.com', 'Password@123')
        User.objects.filter(pk=user.pk).update(public_id='48261937')

        for query in ('4826 1937', '4826-1937', '48261937', '2619'):
            found = accounts_queryset(admin, params={'q': query, 'scope': 'users'})
            self.assertEqual(list(found.values_list('pk', flat=True)), [user.pk], query)


class NumericPublicIdMigrationTests(MigrationTestCase):
    before = [('accounts', '0003_admin_audit_target_idx')]
    after = [('accounts', '0005_user_public_id_digits')]

    def test_legacy_codes_become_numeric_and_audit_logs_follow(self):
        apps = self.migrate(self.before)
        OldUser = apps.get_model('accounts', 'User')
        OldLog = apps.get_model('accounts', 'AdminAccessAuditLog')
        legacy = OldUser.objects.create(email='old@example.com', public_id='usr_61050a7e141d')
        kept = OldUser.objects.create(email='kept@example.com', public_id='34567890')
        OldLog.objects.create(
            public_id='alog_1',
            source='admin',
            action='change_status',
            target_type='user',
            target_public_id='usr_61050a7e141d',
            payload={'user_public_id': 'usr_61050a7e141d', 'reason': 'Spam'},
        )
        OldLog.objects.create(
            public_id='alog_2',
            source='admin',
            action='decide_employer_verification',
            target_type='employer_verification',
            target_public_id='evc_1',
            payload={'user_public_id': 'usr_61050a7e141d'},
        )

        self.migrate(self.after)

        new_code = User.objects.get(pk=legacy.pk).public_id
        self.assertRegex(new_code, ACCOUNT_CODE_REGEX)
        self.assertEqual(User.objects.get(pk=kept.pk).public_id, '34567890')
        timeline = AdminAccessAuditLog.objects.get(public_id='alog_1')
        self.assertEqual(timeline.target_public_id, new_code)
        self.assertEqual(timeline.payload, {'user_public_id': new_code, 'reason': 'Spam'})
        decision = AdminAccessAuditLog.objects.get(public_id='alog_2')
        self.assertEqual(decision.target_public_id, 'evc_1')
        self.assertEqual(decision.payload, {'user_public_id': new_code})

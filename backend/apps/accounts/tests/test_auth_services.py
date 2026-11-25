"""Unit tests for the auth workflows that live in services/ (views only map HTTP)."""

from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from django.utils import translation
from rest_framework.exceptions import NotFound, ValidationError

from ..models import AuthEmailJob, AuthSession, User
from ..services import email_verification, password_reset
from ..services.auth_sessions import revoke_other_sessions, revoke_own_session
from ..services.exceptions import PasswordSetupCodeCooldown, VerificationCooldown
from ..services.profile import update_own_profile
from ..services.registration import register_account
from ..services.tokens import issue_tokens
from ..services.verification import (
    change_unverified_email,
    confirm_email_verification,
    resend_verification_email,
)


class AuthServiceTestCase(TestCase):
    def setUp(self):
        cache.clear()
        patcher = patch('apps.accounts.tasks.auth_email.deliver_auth_email_job.delay')
        patcher.start()
        self.addCleanup(patcher.stop)
        self.user = User.objects.create_user(email='owner@example.com', password='Password@123')


class VerificationServiceTests(AuthServiceTestCase):
    def test_resend_refuses_verified_account(self):
        self.user.email_verified = True

        with self.assertRaises(ValidationError) as verified:
            resend_verification_email(self.user)

        self.assertEqual(verified.exception.detail, {'detail': 'Email đã được xác thực.'})
        self.assertFalse(AuthEmailJob.objects.exists())

    # LocMemCache của test không có ``ttl``; cooldown thật dựa vào Redis.
    @patch.object(email_verification, 'cooldown_remaining', side_effect=[0, 60, 42])
    def test_resend_queues_email_then_reports_cooldown(self, _cooldown):
        self.assertEqual(resend_verification_email(self.user), 60)
        self.assertEqual(
            AuthEmailJob.objects.filter(kind=AuthEmailJob.Kind.VERIFICATION).count(), 1
        )

        with self.assertRaises(VerificationCooldown) as cooldown:
            resend_verification_email(self.user)

        self.assertEqual(cooldown.exception.status_code, 429)
        self.assertEqual(
            cooldown.exception.payload(),
            {'detail': 'Vui lòng chờ 42s trước khi gửi lại.', 'retry_after': 42},
        )

    def test_confirm_marks_verified_once_and_rejects_reused_token(self):
        token = email_verification.issue_token(self.user)

        confirm_email_verification(token)

        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)
        with self.assertRaises(ValidationError):
            confirm_email_verification(token)

    def test_confirm_rejects_token_issued_for_previous_email(self):
        token = email_verification.issue_token(self.user)
        User.objects.filter(pk=self.user.pk).update(email='other@example.com')

        with self.assertRaises(ValidationError):
            confirm_email_verification(token)
        self.assertFalse(User.objects.get(pk=self.user.pk).email_verified)

    def test_change_email_notifies_old_address_and_locks_verified_accounts(self):
        user = change_unverified_email(self.user, 'new@example.com')

        self.assertEqual(user.email, 'new@example.com')
        notice = AuthEmailJob.objects.get(kind=AuthEmailJob.Kind.EMAIL_CHANGED_NOTICE)
        self.assertEqual(notice.context['recipient'], 'owner@example.com')

        User.objects.filter(pk=user.pk).update(email_verified=True)
        with self.assertRaises(ValidationError):
            change_unverified_email(user, 'third@example.com')
        self.assertEqual(User.objects.get(pk=user.pk).email, 'new@example.com')


class PasswordResetServiceTests(AuthServiceTestCase):
    @patch.object(password_reset, 'cooldown_remaining', side_effect=[0, 30])
    def test_request_queues_only_for_the_portal_account_and_is_rate_limited(self, _cooldown):
        password_reset.request_password_reset('OWNER@example.com', 'employer')
        self.assertFalse(AuthEmailJob.objects.filter(kind=AuthEmailJob.Kind.PASSWORD_RESET))

        password_reset.request_password_reset('OWNER@example.com', 'main')
        password_reset.request_password_reset('owner@example.com', 'main')
        self.assertEqual(
            AuthEmailJob.objects.filter(kind=AuthEmailJob.Kind.PASSWORD_RESET).count(), 1
        )

    def test_reset_consumes_link_sets_password_and_verifies_email(self):
        token = password_reset.issue_token(self.user)
        self.assertEqual(password_reset.validate_reset_token(token, 'main'), self.user)

        password_reset.reset_password(token, 'NewPassword@123', 'main')

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPassword@123'))
        self.assertTrue(self.user.email_verified)
        with self.assertRaises(ValidationError):
            password_reset.validate_reset_token(token, 'main')

    def test_admin_link_is_rejected_outside_admin_portal(self):
        admin = User.objects.create_user(
            email='root@example.com', password='Password@123', role=User.Role.ADMIN
        )
        token = password_reset.issue_token(admin)

        with self.assertRaises(ValidationError):
            password_reset.validate_reset_token(token)
        self.assertEqual(password_reset.validate_reset_token(token, 'admin'), admin)


class AccountServiceTests(AuthServiceTestCase):
    def test_register_account_queues_verification_email(self):
        user = register_account(
            email='new@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            full_name='Nhà tuyển dụng',
        )

        self.assertTrue(user.check_password('Password@123'))
        self.assertEqual(user.role, User.Role.EMPLOYER)
        self.assertTrue(
            AuthEmailJob.objects.filter(user=user, kind=AuthEmailJob.Kind.VERIFICATION).exists()
        )

    def test_update_own_profile_persists_changes(self):
        update_own_profile(self.user, {'full_name': 'Lê Văn A', 'phone': '0912345678'})

        self.user.refresh_from_db()
        self.assertEqual((self.user.full_name, self.user.phone), ('Lê Văn A', '0912345678'))

    def test_password_setup_cooldown_payload_tells_when_to_retry(self):
        error = PasswordSetupCodeCooldown(42)

        self.assertEqual(error.status_code, 429)
        self.assertEqual(error.payload()['code'], 'password_setup_code_cooldown')
        self.assertEqual(error.payload()['retry_after'], 42)


class SessionServiceTests(AuthServiceTestCase):
    def test_revoke_other_sessions_keeps_the_current_one(self):
        for _ in range(3):
            issue_tokens(self.user)
        sessions = list(AuthSession.objects.filter(user=self.user))
        current = sessions[0]

        revoked = revoke_other_sessions(self.user, str(current.id))

        self.assertEqual(revoked, len(sessions) - 1)
        self.assertEqual(
            list(AuthSession.objects.filter(user=self.user, revoked_at__isnull=True)), [current]
        )

    def test_revoke_own_session_is_scoped_to_the_account(self):
        other = User.objects.create_user(email='other@example.com', password='Password@123')
        issue_tokens(other)
        foreign = AuthSession.objects.get(user=other)

        with self.assertRaises(NotFound):
            revoke_own_session(self.user, foreign.id)
        foreign.refresh_from_db()
        self.assertIsNone(foreign.revoked_at)


class PreferredLanguageDefaultTests(TestCase):
    def test_new_account_inherits_active_ui_language(self):
        with translation.override('en'):
            english = User.objects.create_user(email='en@example.com', password='Password@123')
        vietnamese = User.objects.create_user(email='vi@example.com', password='Password@123')

        self.assertEqual(english.preferred_language, User.Language.EN)
        self.assertEqual(vietnamese.preferred_language, User.Language.VI)

    def test_unsupported_active_language_falls_back_to_vietnamese(self):
        with translation.override('fr'):
            user = User.objects.create_user(email='fr@example.com', password='Password@123')

        self.assertEqual(user.preferred_language, User.Language.VI)

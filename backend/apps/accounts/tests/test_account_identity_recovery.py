import json
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts import oauth
from apps.accounts.models import (
    AdminAccessAuditLog,
    AdminPermission,
    AdminRole,
    AuthEmailJob,
    AuthSession,
    Department,
    SocialAccount,
    User,
)
from apps.accounts.services import (
    assign_membership,
    email_verification,
    password_reset,
    two_factor,
)
from apps.accounts.services.refresh_cookies import cookie_name
from apps.accounts.services.tokens import issue_tokens


@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class AccountIdentityRecoveryApiTests(APITestCase):
    password = 'StrongPass@123'
    reason = 'Người dùng báo mất quyền truy cập tài khoản.'
    evidence = 'Đã đối chiếu giấy tờ và gọi lại số điện thoại hồ sơ.'

    def setUp(self):
        cache.clear()
        self.delay = patch('apps.accounts.tasks.auth_email.deliver_auth_email_job.delay').start()
        self.addCleanup(patch.stopall)
        self.superuser = User.objects.create_user(
            email='identity-root@example.com',
            password=self.password,
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_active=True,
            is_staff=True,
            is_superuser=True,
        )
        self.target = User.objects.create_user(
            email='identity-old@example.com',
            password=self.password,
            role=User.Role.CANDIDATE,
            status=User.Status.ACTIVE,
            is_active=True,
            email_verified=True,
            two_factor_enabled=True,
            two_factor_email_enabled=True,
            two_factor_totp_secret='encrypted-totp-secret',
            two_factor_backup_code_hashes=[
                make_password('12345678'),
                make_password('87654321'),
            ],
        )
        self.client.force_authenticate(self.superuser)

    def _email_payload(self, email='Identity-New@Example.com'):
        return {
            'email': email,
            'reason': self.reason,
            'verification_evidence': self.evidence,
        }

    def _mfa_payload(self):
        return {
            'reason': self.reason,
            'verification_evidence': self.evidence,
        }

    def _impact(self, action, payload, *, target=None):
        target = target or self.target
        response = self.client.post(
            reverse(
                f'admin-account-{action}',
                kwargs={'public_id': target.public_id},
            ),
            payload,
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return response.data

    def _confirm(self, action, payload, impact_token, *, target=None):
        target = target or self.target
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                reverse(
                    f'admin-account-{action}',
                    kwargs={'public_id': target.public_id},
                ),
                {**payload, 'impact_token': impact_token},
                format='json',
            )

    def test_email_then_mfa_recovery_invalidates_old_identity_artifacts(self):
        SocialAccount.objects.create(
            user=self.target,
            provider=User.Provider.GOOGLE,
            provider_user_id='google-identity-1',
            email=self.target.email,
            raw_profile={'provider_secret': 'must-not-be-audited'},
        )
        tokens = issue_tokens(self.target)
        reset_token = password_reset.issue_token(self.target)
        challenge = two_factor.start_login_challenge(self.target, 'main')
        challenge_code = cache.get(two_factor._code_key(self.target.pk, two_factor.PURPOSE_LOGIN))
        oauth_code = oauth.create_one_time_code(self.target)
        for kind in (
            AuthEmailJob.Kind.VERIFICATION,
            AuthEmailJob.Kind.PASSWORD_RESET,
            AuthEmailJob.Kind.TWO_FACTOR,
        ):
            AuthEmailJob.objects.create(
                user=self.target,
                kind=kind,
                context={
                    'email': self.target.email,
                    'auth_revision': self.target.auth_revision,
                },
            )

        payload = self._email_payload()
        impact = self._impact('email-impact', payload)

        self.assertEqual(impact['after']['email'], 'identity-new@example.com')
        self.assertTrue(impact['password_reset_required'])
        self.assertTrue(impact['email_verification_required'])
        self.assertEqual(impact['oauth_providers_to_revoke'], ['google'])
        self.assertEqual(impact['mfa_methods']['backup_codes_remaining'], 2)
        self.assertEqual(impact['active_session_count'], 1)

        changed = self._confirm(
            'change-email',
            payload,
            impact['impact_token'],
        )

        self.assertEqual(changed.status_code, status.HTTP_200_OK, changed.data)
        self.target.refresh_from_db()
        self.assertEqual(self.target.email, 'identity-new@example.com')
        self.assertFalse(self.target.email_verified)
        self.assertFalse(self.target.has_usable_password())
        self.assertEqual(self.target.auth_revision, 2)
        self.assertFalse(self.target.social_accounts.exists())
        self.assertFalse(
            AuthSession.objects.filter(
                user=self.target,
                revoked_at__isnull=True,
            ).exists()
        )
        self.assertEqual(
            AuthEmailJob.objects.filter(
                user=self.target,
                status=AuthEmailJob.Status.CANCELLED,
            ).count(),
            3,
        )

        stale_client = APIClient()
        stale_client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')
        self.assertEqual(
            stale_client.get(reverse('auth-me')).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        stale_client.credentials()
        stale_client.cookies[cookie_name('main')] = tokens['refresh']
        self.assertEqual(
            stale_client.post(
                reverse('auth-refresh'),
                {'portal': 'main'},
                format='json',
            ).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        stale_client.cookies.clear()
        self.assertEqual(
            stale_client.get(
                reverse('auth-password-reset-validate'),
                {'token': reset_token},
            ).status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            stale_client.post(
                reverse('auth-two-factor-login-verify'),
                {
                    'challenge': challenge,
                    'code': challenge_code,
                    'method': 'email',
                },
                format='json',
            ).status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            stale_client.post(
                reverse('auth-oauth-complete'),
                {'code': oauth_code},
                format='json',
            ).status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        notice = AuthEmailJob.objects.get(
            user=self.target,
            kind=AuthEmailJob.Kind.EMAIL_CHANGED_NOTICE,
        )
        verification = AuthEmailJob.objects.get(
            user=self.target,
            kind=AuthEmailJob.Kind.VERIFICATION,
            status=AuthEmailJob.Status.PENDING,
        )
        self.assertEqual(notice.context['recipient'], 'identity-old@example.com')
        self.assertEqual(notice.context['new_email'], 'identity-new@example.com')
        self.assertEqual(verification.context['email'], 'identity-new@example.com')
        self.assertEqual(verification.context['auth_revision'], 2)
        self.assertNotIn('verification_evidence', notice.context)
        self.assertNotIn('verification_evidence', verification.context)

        email_audit = AdminAccessAuditLog.objects.get(action='change_account_email')
        self.assertEqual(email_audit.payload['verification_evidence'], self.evidence)
        self.assertEqual(email_audit.payload['revoked_oauth_providers'], ['google'])
        audit_text = json.dumps(email_audit.payload)
        self.assertNotIn('must-not-be-audited', audit_text)
        self.assertNotIn('encrypted-totp-secret', audit_text)

        verification_token = email_verification.issue_token(self.target)
        new_reset_token = password_reset.issue_token(self.target)
        mfa_impact = self._impact('mfa-impact', self._mfa_payload())
        self.assertTrue(mfa_impact['methods_to_disable']['email'])
        self.assertTrue(mfa_impact['methods_to_disable']['totp'])
        self.assertEqual(
            mfa_impact['methods_to_disable']['backup_codes_remaining'],
            2,
        )
        self.assertTrue(mfa_impact['password_will_remain_unchanged'])

        reset = self._confirm(
            'reset-mfa',
            self._mfa_payload(),
            mfa_impact['impact_token'],
        )

        self.assertEqual(reset.status_code, status.HTTP_200_OK, reset.data)
        self.target.refresh_from_db()
        self.assertEqual(self.target.auth_revision, 3)
        self.assertFalse(self.target.two_factor_enabled)
        self.assertFalse(self.target.two_factor_email_enabled)
        self.assertEqual(self.target.two_factor_totp_secret, '')
        self.assertEqual(self.target.two_factor_backup_code_hashes, [])
        self.assertFalse(self.target.has_usable_password())
        self.assertIsNone(password_reset.peek_token(new_reset_token))
        mfa_notice = AuthEmailJob.objects.get(
            user=self.target,
            kind=AuthEmailJob.Kind.MFA_RESET_NOTICE,
        )
        self.assertEqual(mfa_notice.context['recipient'], 'identity-new@example.com')
        self.assertEqual(mfa_notice.context['portal'], User.Role.CANDIDATE)
        self.assertIn('occurred_at', mfa_notice.context)
        self.assertNotIn('verification_evidence', mfa_notice.context)

        verified = stale_client.post(
            reverse('auth-verify-confirm'),
            {'token': verification_token},
            format='json',
        )
        self.assertEqual(verified.status_code, status.HTTP_200_OK, verified.data)
        self.target.refresh_from_db()
        self.assertTrue(self.target.email_verified)

    def test_mfa_reset_preserves_password_oauth_email_and_status(self):
        social = SocialAccount.objects.create(
            user=self.target,
            provider=User.Provider.LINKEDIN,
            provider_user_id='linkedin-identity-1',
            email=self.target.email,
        )
        before_password = self.target.password
        impact = self._impact('mfa-impact', self._mfa_payload())

        response = self._confirm(
            'reset-mfa',
            self._mfa_payload(),
            impact['impact_token'],
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.target.refresh_from_db()
        self.assertEqual(self.target.password, before_password)
        self.assertTrue(self.target.check_password(self.password))
        self.assertEqual(self.target.email, 'identity-old@example.com')
        self.assertTrue(self.target.email_verified)
        self.assertEqual(self.target.status, User.Status.ACTIVE)
        self.assertTrue(SocialAccount.objects.filter(pk=social.pk).exists())

    def test_recovery_validation_permissions_and_stale_preview_fail_closed(self):
        self_recovery = self.client.post(
            reverse(
                'admin-account-email-impact',
                kwargs={'public_id': self.superuser.public_id},
            ),
            self._email_payload('identity-root-new@example.com'),
            format='json',
        )
        self.assertEqual(self_recovery.status_code, status.HTTP_400_BAD_REQUEST)

        pending = User.objects.create_user(
            email='pending-recovery@example.com',
            password=None,
            role=User.Role.CANDIDATE,
            status=User.Status.PENDING,
            is_active=False,
        )
        pending_response = self.client.post(
            reverse(
                'admin-account-email-impact',
                kwargs={'public_id': pending.public_id},
            ),
            self._email_payload('pending-new@example.com'),
            format='json',
        )
        self.assertEqual(pending_response.status_code, status.HTTP_400_BAD_REQUEST)

        deleted = User.objects.create_user(
            email='deleted-recovery@example.com',
            password=self.password,
            role=User.Role.CANDIDATE,
            is_deleted=True,
        )
        deleted_response = self.client.post(
            reverse(
                'admin-account-mfa-impact',
                kwargs={'public_id': deleted.public_id},
            ),
            self._mfa_payload(),
            format='json',
        )
        self.assertEqual(deleted_response.status_code, status.HTTP_404_NOT_FOUND)

        other = User.objects.create_user(
            email='oauth-owner@example.com',
            password=self.password,
            role=User.Role.CANDIDATE,
        )
        SocialAccount.objects.create(
            user=other,
            provider=User.Provider.GOOGLE,
            provider_user_id='oauth-owner-1',
            email='claimed-via-oauth@example.com',
        )
        duplicate = self.client.post(
            reverse(
                'admin-account-email-impact',
                kwargs={'public_id': self.target.public_id},
            ),
            self._email_payload('CLAIMED-VIA-OAUTH@example.com'),
            format='json',
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

        impact = self._impact('mfa-impact', self._mfa_payload())
        self.target.two_factor_backup_code_hashes.append(make_password('11112222'))
        self.target.save(update_fields=['two_factor_backup_code_hashes', 'updated_at'])
        stale = self._confirm(
            'reset-mfa',
            self._mfa_payload(),
            impact['impact_token'],
        )
        self.assertEqual(stale.status_code, status.HTTP_409_CONFLICT)

        no_mfa = User.objects.create_user(
            email='no-mfa@example.com',
            password=self.password,
            role=User.Role.CANDIDATE,
        )
        no_mfa_impact = self._impact(
            'mfa-impact',
            self._mfa_payload(),
            target=no_mfa,
        )
        self.assertFalse(no_mfa_impact['can_apply'])
        no_mfa_confirm = self._confirm(
            'reset-mfa',
            self._mfa_payload(),
            no_mfa_impact['impact_token'],
            target=no_mfa,
        )
        self.assertEqual(
            no_mfa_confirm.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_non_superuser_cannot_recover_an_admin_target(self):
        email_permission = AdminPermission.objects.get(code='account.email.manage')
        supporting_permissions = [
            AdminPermission.objects.get_or_create(
                code=code,
                defaults={'module': 'account', 'label': code},
            )[0]
            for code in (
                'account.view',
                'account.security.manage',
                'account.admin.view',
            )
        ]
        department = Department.objects.create(
            code='identity-recovery',
            name='Khôi phục danh tính',
        )
        role = AdminRole.objects.create(
            department=department,
            code='identity-recovery-operator',
            name='Nhân viên khôi phục',
        )
        role.permissions.add(email_permission, *supporting_permissions)
        operator = User.objects.create_user(
            email='identity-operator@example.com',
            password=self.password,
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_active=True,
        )
        assign_membership(operator, role, actor=self.superuser)
        admin_target = User.objects.create_user(
            email='admin-target@example.com',
            password=self.password,
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_active=True,
        )
        self.client.force_authenticate(operator)

        response = self.client.post(
            reverse(
                'admin-account-email-impact',
                kwargs={'public_id': admin_target.public_id},
            ),
            self._email_payload('admin-target-new@example.com'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_permissions_are_seeded_without_default_role_grants(self):
        codes = {'account.email.manage', 'account.mfa.reset'}
        self.assertEqual(
            set(
                AdminPermission.objects.filter(code__in=codes).values_list(
                    'code',
                    flat=True,
                )
            ),
            codes,
        )
        self.assertFalse(AdminRole.objects.filter(permissions__code__in=codes).exists())


@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class AuthRevisionCompatibilityTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='legacy-revision@example.com',
            password='StrongPass@123',
            role=User.Role.CANDIDATE,
        )

    def test_legacy_access_without_claim_only_works_at_revision_one(self):
        issued = issue_tokens(self.user)
        legacy = AccessToken(issued['access'])
        legacy.payload.pop('auth_rev')
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {legacy}')

        self.assertEqual(client.get(reverse('auth-me')).status_code, status.HTTP_200_OK)

        self.user.auth_revision = 2
        self.user.save(update_fields=['auth_revision', 'updated_at'])

        self.assertEqual(
            client.get(reverse('auth-me')).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_stale_authenticated_user_cannot_issue_a_new_session(self):
        stale_user = User.objects.get(pk=self.user.pk)
        User.objects.filter(pk=self.user.pk).update(auth_revision=2)

        with self.assertRaises(AuthenticationFailed):
            issue_tokens(stale_user)

        self.assertFalse(AuthSession.objects.filter(user=self.user).exists())

    def test_django_admin_url_is_not_registered_in_test_settings(self):
        self.assertEqual(self.client.get('/admin/').status_code, status.HTTP_404_NOT_FOUND)

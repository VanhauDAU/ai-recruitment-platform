from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import (
    AdminMembership,
    AdminPermission,
    AdminRole,
    Department,
    User,
)
from apps.accounts.services.tokens import issue_tokens

from ..models import Company, CompanyDomainClaim, CompanyDomainClaimEvent, RecruiterProfile
from ..selectors import effective_company_domain_claims
from ..services import (
    DomainClaimError,
    confirm_domain_claim_admin_action,
    create_domain_claim,
    domain_claim_admin_impact,
    normalize_company_domain,
    reconcile_domain_claim,
    rotate_domain_claim,
    verify_domain_claim,
)
from ..tasks.domain_claims import reconcile_company_domain_claims


def make_linked_employer(email='owner@acme.vn', *, company=None):
    user = User.objects.create_user(
        email=email,
        password='Password@123',
        role=User.Role.EMPLOYER,
        email_verified=True,
    )
    company = company or Company.objects.create(
        company_name=f'Company {email}',
        created_by=user,
        email=email,
        website_url=f'https://{email.rsplit("@", 1)[-1]}',
        has_no_website=False,
        has_no_logo=False,
    )
    recruiter = RecruiterProfile.objects.create(
        user=user,
        company=company,
        company_role=RecruiterProfile.CompanyRole.OWNER,
    )
    return user, recruiter, company


def authenticate(client, user):
    tokens = issue_tokens(user, auth_method='mfa')
    client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])


@override_settings(
    REST_FRAMEWORK={
        'DEFAULT_AUTHENTICATION_CLASSES': (
            'apps.accounts.authentication.AccountJWTAuthentication',
        ),
        'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
        'DEFAULT_THROTTLE_RATES': {
            'employer_domain_claim_issue_account': '100/day',
            'employer_domain_claim_issue_ip': '100/day',
            'employer_domain_claim_verify_account': '100/hour',
            'employer_domain_claim_verify_ip': '100/hour',
            'employer_domain_claim_manual_account': '100/day',
            'employer_domain_claim_manual_ip': '100/day',
        },
    }
)
class CompanyDomainClaimApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user, self.recruiter, self.company = make_linked_employer()
        authenticate(self.client, self.user)

    def test_create_derives_domain_and_only_returns_plaintext_once(self):
        with patch('apps.employers.services.domain_claims._offline_tld_extract', return_value=True):
            response = self.client.post(
                reverse('employer-company-domain-claims'), {}, format='json'
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['domain'], 'acme.vn')
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(response.data['method'], 'dns_txt')
        self.assertTrue(response.data['txt_value'].startswith('procv-verification='))
        claim = CompanyDomainClaim.objects.get()
        self.assertNotIn(response.data['txt_value'], claim.token_hash)
        self.assertFalse(
            CompanyDomainClaimEvent.objects.filter(
                payload__icontains='procv-verification='
            ).exists()
        )

        list_response = self.client.get(reverse('employer-company-domain-claims'))
        self.assertNotIn('txt_value', list_response.data[0])

    def test_unverified_or_public_email_cannot_create_claim(self):
        self.user.email_verified = False
        self.user.save(update_fields=['email_verified'])
        response = self.client.post(reverse('employer-company-domain-claims'), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'email_not_verified')

        self.user.email = 'owner@gmail.com'
        self.user.email_verified = True
        self.user.save(update_fields=['email', 'email_verified'])
        with patch('apps.employers.services.domain_claims._offline_tld_extract', return_value=True):
            response = self.client.post(
                reverse('employer-company-domain-claims'), {}, format='json'
            )
        self.assertEqual(response.data['code'], 'public_email_domain')

    def test_verify_uses_hash_and_exact_dns_txt(self):
        with patch('apps.employers.services.domain_claims._offline_tld_extract', return_value=True):
            claim, txt_value = create_domain_claim(recruiter=self.recruiter)
        value = txt_value
        with patch('apps.employers.services.domain_claims._dns_txt_values', return_value={value}):
            response = self.client.post(
                reverse(
                    'employer-company-domain-claim-verify',
                    kwargs={'public_id': claim.public_id},
                ),
                {},
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], 'verified')
        self.assertNotIn('txt_value', response.data)

    def test_rotate_rechecks_current_email_domain_and_lock_version(self):
        with patch('apps.employers.services.domain_claims._offline_tld_extract', return_value=True):
            claim, _ = create_domain_claim(recruiter=self.recruiter)
            self.user.email = 'owner@other.vn'
            self.user.save(update_fields=['email'])
            with self.assertRaises(DomainClaimError) as error:
                rotate_domain_claim(
                    claim_public_id=claim.public_id,
                    recruiter=self.recruiter,
                    lock_version=claim.lock_version,
                )
        self.assertEqual(error.exception.code, 'email_domain_changed')

    def test_issue_throttle_does_not_lock_other_accounts_on_shared_ip(self):
        second_user, _, _ = make_linked_employer('owner@second.vn')
        url = reverse('employer-company-domain-claims')

        rates = {
            'employer_domain_claim_issue_account': '1/day',
            'employer_domain_claim_issue_ip': '100/day',
        }
        with (
            patch.dict(ScopedRateThrottle.THROTTLE_RATES, rates),
            patch(
                'apps.employers.services.domain_claims._offline_tld_extract',
                return_value=True,
            ),
        ):
            first = self.client.post(url, {}, format='json')
            authenticate(self.client, second_user)
            second = self.client.post(url, {}, format='json')
            authenticate(self.client, self.user)
            throttled = self.client.post(url, {}, format='json')

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertEqual(throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class CompanyDomainClaimPolicyTests(APITestCase):
    def test_idna_is_exact_ascii_and_rejects_wildcard(self):
        with patch('apps.employers.services.domain_claims._offline_tld_extract', return_value=True):
            self.assertEqual(normalize_company_domain(' BÜCHER.vn. '), 'xn--bcher-kva.vn')
            with self.assertRaises(DomainClaimError):
                normalize_company_domain('*.acme.vn')

    def test_pending_claims_do_not_reserve_domain_but_active_claim_is_unique(self):
        _, recruiter_a, _ = make_linked_employer('owner-a@acme.vn')
        _, recruiter_b, _ = make_linked_employer('owner-b@acme.vn')
        with patch('apps.employers.services.domain_claims._offline_tld_extract', return_value=True):
            claim_a, value_a = create_domain_claim(recruiter=recruiter_a)
            claim_b, value_b = create_domain_claim(recruiter=recruiter_b)
        self.assertEqual(CompanyDomainClaim.objects.filter(domain='acme.vn').count(), 2)

        verify_domain_claim(
            claim_public_id=claim_a.public_id,
            recruiter=recruiter_a,
            resolver=lambda _name: {value_a},
        )
        with self.assertRaises(DomainClaimError) as error:
            verify_domain_claim(
                claim_public_id=claim_b.public_id,
                recruiter=recruiter_b,
                resolver=lambda _name: {value_b},
            )
        self.assertEqual(error.exception.code, 'domain_owned_by_another_company')
        claim_b.refresh_from_db()
        self.assertEqual(claim_b.status, CompanyDomainClaim.Status.PENDING)

    def test_recheck_enters_grace_then_revokes_after_seven_days(self):
        _, recruiter, _ = make_linked_employer()
        with patch('apps.employers.services.domain_claims._offline_tld_extract', return_value=True):
            claim, value = create_domain_claim(recruiter=recruiter)
        verified = verify_domain_claim(
            claim_public_id=claim.public_id,
            recruiter=recruiter,
            resolver=lambda _name: {value},
        )
        now = timezone.now()
        grace = reconcile_domain_claim(verified, resolver=lambda _name: set(), now=now)
        self.assertEqual(grace.status, CompanyDomainClaim.Status.GRACE)
        self.assertEqual(grace.grace_expires_at, now + timedelta(days=7))
        revoked = reconcile_domain_claim(
            grace,
            resolver=lambda _name: set(),
            now=now + timedelta(days=8),
        )
        self.assertEqual(revoked.status, CompanyDomainClaim.Status.REVOKED)

    def test_expired_grace_fails_closed_before_periodic_task_runs(self):
        _, recruiter, company = make_linked_employer()
        CompanyDomainClaim.objects.create(
            company=company,
            requested_by=recruiter.user,
            domain='acme.vn',
            method=CompanyDomainClaim.Method.DNS_TXT,
            status=CompanyDomainClaim.Status.GRACE,
            grace_expires_at=timezone.now() - timedelta(microseconds=1),
        )
        self.assertFalse(
            effective_company_domain_claims(company_id=company.pk, domain='acme.vn').exists()
        )

    def test_event_is_append_only(self):
        _, recruiter, _ = make_linked_employer()
        with patch('apps.employers.services.domain_claims._offline_tld_extract', return_value=True):
            claim, _ = create_domain_claim(recruiter=recruiter)
        event = claim.events.first()
        event.payload = {'changed': True}
        with self.assertRaises(ValueError):
            event.save()
        with self.assertRaises(ValueError):
            event.delete()
        with self.assertRaises(ValueError):
            CompanyDomainClaimEvent.objects.filter(pk=event.pk).update(payload={})
        with self.assertRaises(ValueError):
            CompanyDomainClaimEvent.objects.filter(pk=event.pk).delete()

    def test_challenge_expiry_is_persisted_before_error(self):
        _, recruiter, _ = make_linked_employer()
        with patch('apps.employers.services.domain_claims._offline_tld_extract', return_value=True):
            claim, value = create_domain_claim(recruiter=recruiter)
        claim.challenge_expires_at = timezone.now() - timedelta(seconds=1)
        claim.save(update_fields=['challenge_expires_at'])
        with self.assertRaises(DomainClaimError) as error:
            verify_domain_claim(
                claim_public_id=claim.public_id,
                recruiter=recruiter,
                resolver=lambda _name: {value},
            )
        self.assertEqual(error.exception.code, 'challenge_expired')
        claim.refresh_from_db()
        self.assertEqual(claim.status, CompanyDomainClaim.Status.EXPIRED)

    @override_settings(EMPLOYER_DOMAIN_RECHECK_BATCH_SIZE=10)
    @patch('apps.employers.tasks.domain_claims.reconcile_domain_claim')
    def test_periodic_task_batches_due_claims(self, reconcile):
        _, recruiter, company = make_linked_employer()
        claim = CompanyDomainClaim.objects.create(
            company=company,
            requested_by=recruiter.user,
            domain='acme.vn',
            method=CompanyDomainClaim.Method.DNS_TXT,
            status=CompanyDomainClaim.Status.VERIFIED,
            next_check_at=timezone.now() - timedelta(seconds=1),
        )
        reconcile.return_value = claim
        result = reconcile_company_domain_claims()
        self.assertEqual(result, {'processed': 1, 'failures': 0})
        reconcile.assert_called_once()


class CompanyDomainClaimManualReviewTests(APITestCase):
    def setUp(self):
        self.requester, self.recruiter, self.company = make_linked_employer()
        self.admin = User.objects.create_superuser(
            email='domain-admin@example.com',
            password='Password@123',
        )
        self.admin.is_superuser = False
        self.admin.save(update_fields=['is_superuser'])
        department = Department.objects.create(
            code='domain-tests',
            name='Domain tests',
            is_system_managed=False,
        )
        role = AdminRole.objects.create(
            department=department,
            code='reviewer',
            name='Reviewer',
        )
        permissions = []
        for code in ('employer_domain.view', 'employer_domain.review'):
            permission, _ = AdminPermission.objects.get_or_create(
                code=code,
                defaults={'module': 'employer_domain', 'label': code},
            )
            permissions.append(permission)
        role.permissions.set(permissions)
        AdminMembership.objects.create(user=self.admin, role=role, is_primary=True)

    def _manual_claim(self):
        with patch('apps.employers.services.domain_claims._offline_tld_extract', return_value=True):
            claim, _ = create_domain_claim(recruiter=self.recruiter)
        claim.method = CompanyDomainClaim.Method.ADMIN_MANUAL
        claim.manual_review_requested_at = timezone.now()
        claim.save()
        return claim

    def test_manual_approval_requires_current_approved_legal_documents(self):
        claim = self._manual_claim()
        impact = domain_claim_admin_impact(
            claim,
            actor=self.admin,
            action='approve_manual',
            reason='Đã đối chiếu hồ sơ.',
        )
        with self.assertRaises(DomainClaimError) as error:
            confirm_domain_claim_admin_action(
                claim,
                actor=self.admin,
                action='approve_manual',
                reason='Đã đối chiếu hồ sơ.',
                impact_token=impact['impact_token'],
            )
        self.assertEqual(error.exception.code, 'legal_verification_required')

    @patch('apps.employers.services.domain_claims.verification_checks')
    def test_manual_approval_expires_after_twelve_calendar_months(self, checks):
        checks.return_value = {
            'case_approved': True,
            'business_documents_approved': True,
        }
        from ..models import EmployerVerificationCase

        EmployerVerificationCase.objects.create(
            recruiter=self.recruiter,
            company=self.company,
            status=EmployerVerificationCase.Status.APPROVED,
        )
        claim = self._manual_claim()
        impact = domain_claim_admin_impact(
            claim,
            actor=self.admin,
            action='approve_manual',
            reason='Đã đối chiếu hồ sơ.',
        )
        approved = confirm_domain_claim_admin_action(
            claim,
            actor=self.admin,
            action='approve_manual',
            reason='Đã đối chiếu hồ sơ.',
            impact_token=impact['impact_token'],
        )
        self.assertEqual(approved.status, CompanyDomainClaim.Status.VERIFIED)
        self.assertIsNotNone(approved.expires_at)
        self.assertEqual(approved.expires_at.month, approved.verified_at.month)
        self.assertEqual(approved.expires_at.year, approved.verified_at.year + 1)

    def test_admin_endpoint_is_permission_gated(self):
        outsider = User.objects.create_user(
            email='admin-no-permission@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        authenticate(self.client, outsider)
        response = self.client.get(reverse('admin-company-domain-claim-list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_summary_exposes_live_manual_review_queue(self):
        self._manual_claim()
        authenticate(self.client, self.admin)

        response = self.client.get(reverse('admin-company-domain-claim-summary'))

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['total'], 1)
        self.assertEqual(response.data['manual_pending'], 1)
        self.assertEqual(response.data['dns_pending'], 0)
        self.assertIsNotNone(response.data['oldest_manual_pending_at'])

    def test_admin_detail_includes_company_requester_and_audit_timeline(self):
        claim = self._manual_claim()
        authenticate(self.client, self.admin)

        response = self.client.get(
            reverse('admin-company-domain-claim-detail', args=[claim.public_id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['company_name'], self.company.company_name)
        self.assertEqual(response.data['requested_by_email'], self.requester.email)
        self.assertTrue(response.data['requested_by_email_verified'])
        self.assertEqual(response.data['requester_profile']['public_id'], self.recruiter.public_id)
        self.assertGreaterEqual(len(response.data['events']), 1)

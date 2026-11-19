"""Who approves a join, and how a company changes hands.

"Duyệt tham gia" (owner) and "xác thực tài khoản" (admin) stay separate: only
a verified, active owner approves; without one the administrators do.
"""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.tests.factories import make_admin

from ..models import (
    Company,
    CompanyJoinRequest,
    EmployerCompanyLinkEvent,
    EmployerNotification,
    RecruiterProfile,
)
from ..services import company_owners, request_company_join
from .factories import make_verified_representative

User = get_user_model()


def _employer(email):
    return User.objects.create_user(email=email, password='Password@123', role=User.Role.EMPLOYER)


class CompanyOwnershipTests(APITestCase):
    def setUp(self):
        self.owner = _employer('owner@example.com')
        self.company = Company.objects.create(company_name='Acme', created_by=self.owner)
        make_verified_representative(self.owner, company=self.company)
        self.member = _employer('member@example.com')
        self.member_profile = make_verified_representative(self.member, company=self.company)
        self.requester = _employer('requester@example.com')
        self.admin = make_admin('ops@example.com')

    def _request(self):
        return request_company_join(self.requester, self.company.public_id)

    def _deactivate_owner(self):
        self.owner.is_active = False
        self.owner.save(update_fields=['is_active'])

    def test_an_unverified_owner_cannot_approve_and_admins_take_over(self):
        RecruiterProfile.objects.filter(user=self.owner).update(company_role='member')
        unverified = _employer('unverified@example.com')
        RecruiterProfile.objects.create(
            user=unverified, company=self.company, company_role=RecruiterProfile.CompanyRole.OWNER
        )
        join_request = self._request()
        self.assertFalse(
            EmployerNotification.objects.filter(
                recipient=unverified,
                event_type=EmployerNotification.EventType.COMPANY_JOIN_REQUESTED,
            ).exists()
        )

        self.client.force_authenticate(unverified)
        by_owner = self.client.post(
            reverse(
                'employer-company-join-decision',
                kwargs={'public_id': join_request.public_id, 'decision': 'approve'},
            )
        )
        self.client.force_authenticate(self.admin)
        queue = self.client.get(reverse('admin-company-join-request-list'), {'awaiting_admin': '1'})
        by_admin = self.client.post(
            reverse(
                'admin-company-join-request-decide',
                kwargs={'public_id': join_request.public_id, 'decision': 'approve'},
            )
        )

        self.assertEqual(by_owner.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('xác thực', str(by_owner.data))
        self.assertEqual(
            [row['public_id'] for row in queue.data['results']], [join_request.public_id]
        )
        self.assertTrue(queue.data['results'][0]['can_decide'])
        self.assertEqual(by_admin.status_code, status.HTTP_200_OK, by_admin.data)
        profile = RecruiterProfile.objects.get(user=self.requester)
        self.assertEqual(profile.company, self.company)
        self.assertEqual(profile.company_role, RecruiterProfile.CompanyRole.MEMBER)

    def test_admins_only_watch_while_an_eligible_owner_exists(self):
        join_request = self._request()
        self.client.force_authenticate(self.admin)

        listed = self.client.get(reverse('admin-company-join-request-list'))
        decided = self.client.post(
            reverse(
                'admin-company-join-request-decide',
                kwargs={'public_id': join_request.public_id, 'decision': 'approve'},
            )
        )

        self.assertFalse(listed.data['results'][0]['can_decide'])
        self.assertEqual(decided.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            CompanyJoinRequest.objects.get(pk=join_request.pk).status,
            CompanyJoinRequest.Status.PENDING,
        )

    def test_requester_sees_that_an_administrator_will_decide(self):
        self._deactivate_owner()
        self._request()
        self.client.force_authenticate(self.requester)

        mine = self.client.get(reverse('employer-company-join-mine'))

        self.assertTrue(mine.data['awaiting_admin'])

    def test_owner_transfers_to_a_verified_member(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            reverse('employer-company-ownership-transfer'),
            {'recruiter': self.member_profile.public_id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT, response.data)
        self.assertEqual(
            list(company_owners(self.company).values_list('user', flat=True)), [self.member.pk]
        )
        self.assertEqual(
            RecruiterProfile.objects.get(user=self.owner).company_role,
            RecruiterProfile.CompanyRole.MEMBER,
        )
        self.assertTrue(
            EmployerCompanyLinkEvent.objects.filter(
                recruiter=self.member_profile,
                event_type=EmployerCompanyLinkEvent.EventType.OWNERSHIP_TRANSFERRED,
            ).exists()
        )

    def test_transfer_refuses_an_unverified_member(self):
        stranger = _employer('fresh@example.com')
        fresh = RecruiterProfile.objects.create(user=stranger, company=self.company)
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            reverse('employer-company-ownership-transfer'),
            {'recruiter': fresh.public_id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_assigns_an_owner_only_when_the_company_has_none(self):
        url = reverse('admin-company-assign-owner', kwargs={'public_id': self.company.public_id})
        payload = {'recruiter': self.member_profile.public_id, 'reason': 'Owner nghỉ việc.'}
        self.client.force_authenticate(self.admin)

        while_owned = self.client.post(url, payload, format='json')
        self._deactivate_owner()
        assigned = self.client.post(url, payload, format='json')

        self.assertEqual(while_owned.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(assigned.status_code, status.HTTP_200_OK, assigned.data)
        self.assertEqual(
            RecruiterProfile.objects.get(user=self.owner).company_role,
            RecruiterProfile.CompanyRole.MEMBER,
        )
        self.member_profile.refresh_from_db()
        self.assertEqual(self.member_profile.company_role, RecruiterProfile.CompanyRole.OWNER)

    def test_an_owner_under_compliance_hold_hands_decisions_to_admins(self):
        from ..models import EmployerComplianceHold

        EmployerComplianceHold.objects.create(
            recruiter=RecruiterProfile.objects.get(user=self.owner),
            source=EmployerComplianceHold.Source.DPA,
            reason=EmployerComplianceHold.Reason.DPA_HOLD,
        )
        join_request = self._request()
        self.client.force_authenticate(self.admin)

        queue = self.client.get(reverse('admin-company-join-request-list'), {'awaiting_admin': '1'})

        self.assertEqual(
            [row['public_id'] for row in queue.data['results']], [join_request.public_id]
        )
        self.assertEqual(list(company_owners(self.company)), [])


class CompanyMemberManagementTests(APITestCase):
    def setUp(self):
        self.manager = _employer('manager@example.com')
        self.company = Company.objects.create(company_name='Acme', created_by=self.manager)
        make_verified_representative(self.manager, company=self.company)
        self.member = _employer('member@example.com')
        self.member_profile = make_verified_representative(self.member, company=self.company)

    def _members(self, user=None):
        self.client.force_authenticate(user or self.manager)
        return self.client.get(reverse('employer-company-members'))

    def _remove(self, member_id, reason='Đã nghỉ việc'):
        self.client.force_authenticate(self.manager)
        return self.client.post(
            reverse('employer-company-member-remove', args=[member_id]),
            {'reason': reason},
            format='json',
        )

    def test_manager_sees_members_with_role_verification_and_activity(self):
        from apps.jobs.models import Job

        Job.objects.create(
            posted_by=self.member,
            company=self.company,
            title='Tin',
            description='d',
            status=Job.Status.ACTIVE,
        )

        response = self._members()

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        manager, member = response.data
        self.assertEqual(manager['role_label'], 'Quản lý công ty')
        self.assertTrue(manager['is_me'])
        self.assertEqual(member['role'], 'member')
        self.assertEqual(member['verification_label'], 'Đã xác thực')
        self.assertEqual(member['active_job_count'], 1)
        self.assertTrue(member['can_transfer'])
        self.assertEqual(member['removal_blockers'], ['Còn tin đang tuyển'])
        self.assertNotIn('member@example.com', str(response.data))

    def test_members_cannot_open_the_member_list(self):
        self.assertEqual(self._members(self.member).status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_removes_a_member_and_their_link_is_withdrawn(self):
        response = self._remove(self.member_profile.public_id)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT, response.data)
        self.member_profile.refresh_from_db()
        self.assertIsNone(self.member_profile.company)
        self.assertTrue(
            EmployerCompanyLinkEvent.objects.filter(
                event_type=EmployerCompanyLinkEvent.EventType.MEMBER_REMOVED
            ).exists()
        )
        self.assertTrue(
            EmployerNotification.objects.filter(
                recipient=self.member,
                event_type=EmployerNotification.EventType.COMPANY_LINK_REMOVED,
            ).exists()
        )

    def test_a_removed_member_keeps_a_verified_phone(self):
        self._remove(self.member_profile.public_id)

        self.client.force_authenticate(self.member)
        me = self.client.get(reverse('employer-me'))

        self.assertTrue(me.data['onboarding']['phone_verified'])

    def test_approved_proof_does_not_follow_a_member_back_into_a_company(self):
        from ..models import CompanyDocument

        self._remove(self.member_profile.public_id)
        RecruiterProfile.objects.filter(pk=self.member_profile.pk).update(
            company=self.company, company_role=RecruiterProfile.CompanyRole.MEMBER
        )
        self.client.force_authenticate(self.member)

        documents = self.client.get(reverse('employer-company-documents'), {'scope': 'mine'})
        me = self.client.get(reverse('employer-me'))

        self.assertFalse(
            CompanyDocument.objects.filter(recruiter=self.member_profile, is_current=True).exists()
        )
        self.assertFalse([row for row in documents.data if row.get('is_current') is not False])
        self.assertFalse(me.data['onboarding']['candidate_dpa_submitted'])
        self.assertFalse(me.data['onboarding']['business_doc_submitted'])

    def test_removal_waits_for_running_jobs_and_never_targets_the_manager(self):
        from apps.jobs.models import Job

        Job.objects.create(
            posted_by=self.member,
            company=self.company,
            title='Tin',
            description='d',
            status=Job.Status.ACTIVE,
        )
        manager_profile = RecruiterProfile.objects.get(user=self.manager)

        blocked = self._remove(self.member_profile.public_id)
        self_removal = self._remove(manager_profile.public_id)

        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(blocked.data['blockers'], ['ACTIVE_JOBS_EXIST'])
        self.assertEqual(self_removal.status_code, status.HTTP_400_BAD_REQUEST)
        self.member_profile.refresh_from_db()
        self.assertEqual(self.member_profile.company, self.company)


class CompanyHandoverTests(APITestCase):
    def setUp(self):
        from apps.jobs.models import Job

        self.manager = _employer('ho-manager@example.com')
        self.company = Company.objects.create(company_name='Acme', created_by=self.manager)
        self.manager_profile = make_verified_representative(self.manager, company=self.company)
        self.leaver = _employer('ho-leaver@example.com')
        self.leaver_profile = make_verified_representative(self.leaver, company=self.company)
        self.job = Job.objects.create(
            posted_by=self.leaver,
            company=self.company,
            title='Tin',
            description='d',
            status=Job.Status.ACTIVE,
        )
        self.client.force_authenticate(self.manager)

    def _hand_over(self, target=None):
        return self.client.post(
            reverse('employer-company-handover'),
            {
                'source': self.leaver_profile.public_id,
                'target': target or self.manager_profile.public_id,
            },
            format='json',
        )

    def test_handover_unblocks_removing_a_member_with_running_jobs(self):
        handed = self._hand_over()
        removed = self.client.post(
            reverse('employer-company-member-remove', args=[self.leaver_profile.public_id]),
            {'reason': 'Nghỉ việc'},
            format='json',
        )

        self.assertEqual(handed.status_code, status.HTTP_200_OK, handed.data)
        self.assertEqual(handed.data['job_count'], 1)
        self.job.refresh_from_db()
        self.assertEqual(self.job.posted_by, self.manager)
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT, removed.data)
        self.assertTrue(
            EmployerNotification.objects.filter(
                recipient=self.manager, event_type=EmployerNotification.EventType.JOBS_HANDED_OVER
            ).exists()
        )

    def test_former_members_with_jobs_are_listed_until_handed_over(self):
        RecruiterProfile.objects.filter(pk=self.leaver_profile.pk).update(company=None)

        listed = self.client.get(reverse('employer-company-former-members'))
        self._hand_over()
        after = self.client.get(reverse('employer-company-former-members'))

        self.assertEqual([row['member_id'] for row in listed.data], [self.leaver_profile.public_id])
        self.assertEqual(listed.data[0]['active_job_count'], 1)
        self.assertEqual(after.data, [])

    def test_jobs_only_go_to_a_verified_member(self):
        stranger = _employer('ho-fresh@example.com')
        fresh = RecruiterProfile.objects.create(user=stranger, company=self.company)

        response = self._hand_over(target=fresh.public_id)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.job.refresh_from_db()
        self.assertEqual(self.job.posted_by, self.leaver)

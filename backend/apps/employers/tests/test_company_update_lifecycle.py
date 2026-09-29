from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from ..models import (
    Company,
    CompanyUpdateEvent,
    CompanyUpdateRequest,
    CompanyUpdateRevision,
    RecruiterProfile,
)


class CompanyUpdateLifecycleTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='company-lifecycle-owner@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Công ty vòng đời',
            tax_code='0101234567',
            address='Hà Nội',
            phone='0912345678',
            created_by=self.owner,
        )
        self.owner_profile = RecruiterProfile.objects.create(
            user=self.owner,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
        )
        self.admin = User.objects.create_superuser(
            email='company-lifecycle-admin@example.com',
            password='Password@123',
        )
        self.client.force_authenticate(self.owner)

    def create_request(self, changes=None):
        response = self.client.post(
            reverse('employer-company-update-requests'),
            {'changes': changes or {'address': 'Đà Nẵng'}},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    def start_review(self, request_data):
        self.client.force_authenticate(self.admin)
        return self.client.post(
            reverse(
                'admin-company-update-request-start-review',
                kwargs={'public_id': request_data['public_id']},
            ),
            {
                'lock_version': request_data['lock_version'],
                'revision_public_id': request_data['current_revision_public_id'],
            },
            format='json',
        )

    def decide(self, request_data, decision, note=''):
        return self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': request_data['public_id']},
            ),
            {
                'decision': decision,
                'note': note,
                'lock_version': request_data['lock_version'],
                'revision_public_id': request_data['current_revision_public_id'],
            },
            format='json',
        )

    def test_submission_creates_an_immutable_revision_and_event(self):
        response = self.create_request()

        self.assertEqual(response.data['status'], CompanyUpdateRequest.Status.SUBMITTED)
        update_request = CompanyUpdateRequest.objects.get(public_id=response.data['public_id'])
        revision = update_request.current_revision
        self.assertEqual(revision.number, 1)
        self.assertEqual(revision.changes, {'address': 'Đà Nẵng'})
        self.assertEqual(
            list(update_request.events.values_list('event_type', flat=True)),
            [CompanyUpdateEvent.EventType.SUBMITTED],
        )
        revision.changes = {'address': 'Huế'}
        with self.assertRaisesMessage(ValueError, 'snapshot bất biến'):
            revision.save()
        event = update_request.events.get()
        event.payload = {'tampered': True}
        with self.assertRaisesMessage(ValueError, 'nhật ký bất biến'):
            event.save()

    def test_each_company_member_can_keep_an_independent_active_request(self):
        owner_request = self.create_request({'address': 'Đà Nẵng'})
        member = User.objects.create_user(
            email='company-lifecycle-member@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        RecruiterProfile.objects.create(
            user=member,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
        )
        self.client.force_authenticate(member)

        member_request = self.create_request({'phone': '0987654321'})

        self.assertNotEqual(owner_request.data['public_id'], member_request.data['public_id'])
        self.assertEqual(
            CompanyUpdateRequest.objects.filter(
                company=self.company,
                status=CompanyUpdateRequest.Status.SUBMITTED,
            ).count(),
            2,
        )

    def test_admin_must_lock_exact_revision_before_deciding(self):
        request_data = self.create_request().data
        self.client.force_authenticate(self.admin)
        premature = self.decide(request_data, CompanyUpdateRequest.Status.APPROVED)
        stale = self.client.post(
            reverse(
                'admin-company-update-request-start-review',
                kwargs={'public_id': request_data['public_id']},
            ),
            {
                'lock_version': request_data['lock_version'],
                'revision_public_id': 'cuv_stale',
            },
            format='json',
        )

        self.assertEqual(premature.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(stale.status_code, status.HTTP_409_CONFLICT)
        started = self.start_review(request_data)
        self.assertEqual(started.status_code, status.HTTP_200_OK, started.data)
        self.assertEqual(started.data['status'], CompanyUpdateRequest.Status.IN_REVIEW)

        self.client.force_authenticate(self.owner)
        edit = self.client.post(
            reverse('employer-company-update-requests'),
            {'changes': {'address': 'Huế'}},
            format='json',
        )
        self.assertEqual(edit.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(edit.data['code'], 'COMPANY_UPDATE_IN_REVIEW')

    def test_changes_requested_can_be_resubmitted_as_a_new_revision(self):
        created = self.create_request().data
        started = self.start_review(created)
        requested = self.decide(
            started.data,
            CompanyUpdateRequest.Status.CHANGES_REQUESTED,
            'Cập nhật địa chỉ đầy đủ hơn.',
        )
        self.assertEqual(requested.status_code, status.HTTP_200_OK, requested.data)

        self.client.force_authenticate(self.owner)
        resubmitted = self.client.post(
            reverse('employer-company-update-requests'),
            {'changes': {'address': '123 Đà Nẵng'}},
            format='json',
        )

        self.assertEqual(resubmitted.status_code, status.HTTP_200_OK, resubmitted.data)
        self.assertEqual(resubmitted.data['status'], CompanyUpdateRequest.Status.SUBMITTED)
        self.assertEqual(resubmitted.data['revision'], 2)
        self.assertEqual(
            CompanyUpdateRevision.objects.filter(
                update_request__public_id=created['public_id'],
            ).count(),
            2,
        )

    def test_creator_can_withdraw_and_owner_can_cancel_before_review(self):
        owner_request = self.create_request().data
        withdraw = self.client.post(
            reverse(
                'employer-company-update-request-lifecycle',
                kwargs={
                    'public_id': owner_request['public_id'],
                    'action': 'withdraw',
                },
            ),
            {'lock_version': owner_request['lock_version']},
            format='json',
        )
        self.assertEqual(withdraw.status_code, status.HTTP_200_OK, withdraw.data)
        self.assertEqual(withdraw.data['status'], CompanyUpdateRequest.Status.WITHDRAWN)

        member = User.objects.create_user(
            email='company-cancel-member@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        RecruiterProfile.objects.create(
            user=member,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
        )
        self.client.force_authenticate(member)
        member_request = self.create_request({'phone': '0987654321'}).data
        self.client.force_authenticate(self.owner)
        cancelled = self.client.post(
            reverse(
                'employer-company-update-request-lifecycle',
                kwargs={
                    'public_id': member_request['public_id'],
                    'action': 'cancel',
                },
            ),
            {
                'lock_version': member_request['lock_version'],
                'reason': 'Yêu cầu trùng nội dung đã thống nhất.',
            },
            format='json',
        )
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK, cancelled.data)
        self.assertEqual(cancelled.data['status'], CompanyUpdateRequest.Status.CANCELLED)

    def test_approval_detects_only_overlapping_company_changes(self):
        created = self.create_request({'address': 'Đà Nẵng'}).data
        started = self.start_review(created)
        self.company.phone = '0900000000'
        self.company.save(update_fields=['phone', 'updated_at'])

        approved = self.decide(started.data, CompanyUpdateRequest.Status.APPROVED)

        self.assertEqual(approved.status_code, status.HTTP_200_OK, approved.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.address, 'Đà Nẵng')
        self.assertEqual(self.company.phone, '0900000000')

        self.client.force_authenticate(self.owner)
        second = self.create_request({'address': 'Huế'}).data
        second_started = self.start_review(second)
        self.company.address = 'TP.HCM'
        self.company.save(update_fields=['address', 'updated_at'])
        conflict = self.decide(second_started.data, CompanyUpdateRequest.Status.APPROVED)

        self.assertEqual(conflict.status_code, status.HTTP_409_CONFLICT, conflict.data)
        self.assertEqual(conflict.data['code'], 'company_update_base_conflict')
        self.assertEqual(conflict.data['conflicting_fields'], ['address'])

    def test_unrelated_change_does_not_fabricate_trade_name_update(self):
        self.company.trade_name = ''
        self.company.trade_name_same_as_registered = True
        self.company.save(
            update_fields=['trade_name', 'trade_name_same_as_registered', 'updated_at']
        )

        response = self.create_request({'address': 'Đà Nẵng'})

        self.assertEqual(response.data['changes'], {'address': 'Đà Nẵng'})

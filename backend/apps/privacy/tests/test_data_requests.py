import json
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import AdminAccessAuditLog, SocialAccount, User
from apps.accounts.services import issue_tokens
from apps.accounts.tests.factories import make_admin
from apps.candidates.models import CandidateProfile
from apps.cv_templates.tests.factories import make_published_template
from apps.cvs.models import UserCv
from apps.cvs.services import create_user_cv
from apps.employers.models import RecruiterProfile
from apps.employers.tests.factories import make_company, make_recruiter

from ..models import DataSubjectRequest

LIST_URL = reverse('privacy-requests')


def _auth(client, user):
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_tokens(user)["access"]}')


def _admin_url(data_request, action):
    return reverse(f'admin-privacy-request-{action}', args=[data_request.public_id])


class DataRequestTests(APITestCase):
    def setUp(self):
        self.candidate = User.objects.create_user(
            'ungvien@example.com',
            'Password@123',
            role=User.Role.CANDIDATE,
            full_name='Nguyễn Văn A',
            phone='0901234567',
            email_verified=True,
        )
        CandidateProfile.objects.update_or_create(
            user=self.candidate, defaults={'address': 'Hà Nội'}
        )
        template, _version = make_published_template('Mẫu DSR')
        self.cv = create_user_cv(actor=self.candidate, title='CV của A', template=template)
        self.admin = make_admin()

    def _submit(self, user, kind, note=''):
        _auth(self.client, user)
        return self.client.post(LIST_URL, {'kind': kind, 'note': note}, format='json')

    def test_candidate_submits_one_pending_request_per_kind(self):
        response = self._submit(self.candidate, 'erasure', 'Không dùng nữa')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'pending')

        duplicate = self._submit(self.candidate, 'erasure')
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(self._submit(self.candidate, 'export').status_code, 201)
        self.assertEqual(len(self.client.get(LIST_URL).data), 2)

    def test_admin_account_and_anonymous_cannot_submit(self):
        self.assertEqual(self.client.get(LIST_URL).status_code, 401)
        self.assertEqual(self._submit(self.admin, 'export').status_code, 403)

    def test_candidate_cancels_own_pending_request_only(self):
        request_id = self._submit(self.candidate, 'export').data['public_id']
        other = User.objects.create_user('khac@example.com', 'Password@123', role='candidate')
        _auth(self.client, other)
        url = reverse('privacy-request-cancel', args=[request_id])
        self.assertEqual(self.client.post(url).status_code, 404)

        _auth(self.client, self.candidate)
        self.assertEqual(self.client.post(url).data['status'], 'cancelled')
        self.assertEqual(self.client.post(url).status_code, 400)

    def test_admin_completes_erasure_anonymizes_account_and_deletes_cvs(self):
        self._submit(self.candidate, 'erasure')
        self._submit(self.candidate, 'export')
        SocialAccount.objects.create(user=self.candidate, provider='google', provider_user_id='g1')
        erasure = DataSubjectRequest.objects.get(kind='erasure')
        candidate_access = issue_tokens(self.candidate)['access']

        _auth(self.client, self.admin)
        queue = self.client.get(reverse('admin-privacy-request-list'), {'status': 'pending'})
        self.assertEqual(queue.data['count'], 2)
        response = self.client.post(_admin_url(erasure, 'complete'), {'note': 'Đã xác minh'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'completed')
        self.assertTrue(response.data['account']['is_deleted'])
        self.candidate.refresh_from_db()
        self.assertTrue(self.candidate.is_deleted)
        self.assertFalse(self.candidate.is_active)
        self.assertFalse(self.candidate.has_usable_password())
        self.assertEqual(self.candidate.full_name, '')
        self.assertEqual(self.candidate.phone, '')
        self.assertTrue(self.candidate.email.endswith('@deleted.invalid'))
        self.assertFalse(UserCv.objects.filter(pk=self.cv.pk).exists())
        self.assertFalse(CandidateProfile.objects.filter(user=self.candidate).exists())
        self.assertFalse(SocialAccount.objects.filter(user=self.candidate).exists())
        self.assertEqual(DataSubjectRequest.objects.get(kind='export').status, 'cancelled')
        self.assertTrue(
            AdminAccessAuditLog.objects.filter(action='privacy_request_completed').exists()
        )
        self.assertEqual(self.client.post(_admin_url(erasure, 'complete')).status_code, 400)

        # Đã ẩn danh hóa: tài khoản không gọi được API nữa.
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {candidate_access}')
        self.assertIn(self.client.get(LIST_URL).status_code, {401, 403})

    def test_reject_requires_note_and_keeps_account(self):
        self._submit(self.candidate, 'erasure')
        erasure = DataSubjectRequest.objects.get()
        _auth(self.client, self.admin)

        self.assertEqual(self.client.post(_admin_url(erasure, 'reject'), {}).status_code, 400)
        response = self.client.post(_admin_url(erasure, 'reject'), {'note': 'Đang có tranh chấp'})
        self.assertEqual(response.data['status'], 'rejected')
        self.candidate.refresh_from_db()
        self.assertFalse(self.candidate.is_deleted)

    def test_export_downloadable_after_approval_for_seven_days(self):
        request_id = self._submit(self.candidate, 'export').data['public_id']
        url = reverse('privacy-request-export', args=[request_id])
        self.assertEqual(self.client.get(url).status_code, 400)

        export = DataSubjectRequest.objects.get(public_id=request_id)
        _auth(self.client, self.admin)
        self.client.post(_admin_url(export, 'complete'))

        _auth(self.client, self.candidate)
        listed = self.client.get(LIST_URL).data[0]
        self.assertIsNotNone(listed['export_available_until'])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn('attachment', response['Content-Disposition'])
        payload = json.loads(response.content)
        self.assertEqual(payload['account']['email'], 'ungvien@example.com')
        self.assertEqual(payload['candidate']['profile']['address'], 'Hà Nội')
        self.assertEqual(payload['candidate']['cvs'][0]['title'], 'CV của A')

        DataSubjectRequest.objects.filter(pk=export.pk).update(
            handled_at=timezone.now() - timedelta(days=8)
        )
        self.assertEqual(self.client.get(url).status_code, 400)


class EmployerDataRequestTests(APITestCase):
    def test_owner_with_members_must_transfer_before_erasure(self):
        owner, owner_profile = make_recruiter('owner@example.com')
        company = make_company(owner, name='Công ty DSR')
        owner_profile.company = company
        owner_profile.company_role = RecruiterProfile.CompanyRole.OWNER
        owner_profile.save()
        member, member_profile = make_recruiter('member@example.com')
        member_profile.company = company
        member_profile.company_role = RecruiterProfile.CompanyRole.MEMBER
        member_profile.save()

        _auth(self.client, owner)
        blocked = self.client.post(LIST_URL, {'kind': 'erasure'}, format='json')
        self.assertEqual(blocked.status_code, 400)

        _auth(self.client, member)
        self.assertEqual(
            self.client.post(LIST_URL, {'kind': 'erasure'}, format='json').status_code, 201
        )
        _auth(self.client, make_admin())
        self.client.post(_admin_url(DataSubjectRequest.objects.get(), 'complete'))
        member_profile.refresh_from_db()
        self.assertIsNone(member_profile.verified_phone)
        self.assertIsNone(member_profile.contact_phone)
        self.assertEqual(member_profile.company_id, company.pk)

    def test_employer_export_lists_company_and_profile(self):
        user, _profile = make_recruiter('ntd@example.com')
        _auth(self.client, user)
        request_id = self.client.post(LIST_URL, {'kind': 'export'}, format='json').data['public_id']
        _auth(self.client, make_admin())
        self.client.post(
            _admin_url(DataSubjectRequest.objects.get(public_id=request_id), 'complete')
        )
        _auth(self.client, user)
        payload = json.loads(
            self.client.get(reverse('privacy-request-export', args=[request_id])).content
        )
        self.assertEqual(payload['account']['role'], 'employer')
        self.assertIn('verified_phone', payload['employer']['profile'])

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.employers.models import (
    Company,
    CompanyDocument,
    CompanyUpdateRequest,
    EmployerCompanyLinkEvent,
    EmployerVerificationCase,
    RecruiterProfile,
)

from ..models import AdminAccessAuditLog, User


class EmployerCompanyUnlinkApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='company-unlink-admin@example.com',
            password='Password@123',
        )
        self.employer = User.objects.create_user(
            email='company-unlink-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company_owner = User.objects.create_user(
            email='company-unlink-owner@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Công ty bị chọn nhầm',
            tax_code='0311111111',
            created_by=self.company_owner,
        )
        self.recruiter = RecruiterProfile.objects.create(
            user=self.employer,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
        )
        self.case = EmployerVerificationCase.objects.create(
            recruiter=self.recruiter,
            company=self.company,
        )
        self.client.force_authenticate(self.admin)

    def endpoint(self, action):
        return reverse(
            f'admin-account-{action}',
            kwargs={'public_id': self.employer.public_id},
        )

    def preview(self, reason='Nhà tuyển dụng xác nhận đã chọn nhầm công ty.'):
        return self.client.post(
            self.endpoint('company-unlink-impact'),
            {'reason': reason},
            format='json',
        )

    def test_clean_member_link_requires_preview_then_is_unlinked_with_audit(self):
        preview = self.preview()

        self.assertEqual(preview.status_code, status.HTTP_200_OK, preview.data)
        self.assertTrue(preview.data['can_apply'])
        self.assertEqual(preview.data['blockers'], [])
        response = self.client.post(
            self.endpoint('unlink-company'),
            {
                'reason': 'Nhà tuyển dụng xác nhận đã chọn nhầm công ty.',
                'impact_token': preview.data['impact_token'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.recruiter.refresh_from_db()
        self.case.refresh_from_db()
        self.assertIsNone(self.recruiter.company_id)
        self.assertEqual(self.recruiter.company_role, '')
        self.assertIsNone(self.case.company_id)
        event = EmployerCompanyLinkEvent.objects.get(recruiter=self.recruiter)
        self.assertEqual(event.company_id, self.company.pk)
        self.assertNotIn('email', event.impact_snapshot)
        self.assertTrue(
            AdminAccessAuditLog.objects.filter(
                action='unlink_employer_company',
                target_public_id=self.employer.public_id,
            ).exists()
        )

    def test_owner_or_link_with_business_data_is_not_clean(self):
        self.recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        self.recruiter.save(update_fields=['company_role', 'updated_at'])
        owner_preview = self.preview()
        self.assertEqual(owner_preview.status_code, status.HTTP_200_OK)
        self.assertFalse(owner_preview.data['can_apply'])
        self.assertIn('COMPANY_OWNER_LINK', owner_preview.data['blockers'])
        self.assertEqual(owner_preview.data['impact_token'], '')

        self.recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        self.recruiter.save(update_fields=['company_role', 'updated_at'])
        CompanyDocument.objects.create(
            company=self.company,
            uploaded_by=self.employer,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='private/company-link-proof.pdf',
        )
        document_preview = self.preview()
        self.assertFalse(document_preview.data['can_apply'])
        self.assertIn('COMPANY_DOCUMENTS_EXIST', document_preview.data['blockers'])

        CompanyDocument.objects.all().delete()
        CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.employer,
            changes={'company_name': 'Tên mới'},
        )
        used_preview = self.preview()
        self.assertFalse(used_preview.data['can_apply'])
        self.assertIn('COMPANY_UPDATE_REQUESTS_EXIST', used_preview.data['blockers'])

    def test_new_business_data_after_preview_makes_confirmation_stale(self):
        preview = self.preview()
        CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.employer,
            changes={'company_name': 'Tên mới'},
        )

        response = self.client.post(
            self.endpoint('unlink-company'),
            {
                'reason': 'Nhà tuyển dụng xác nhận đã chọn nhầm công ty.',
                'impact_token': preview.data['impact_token'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.data)
        self.recruiter.refresh_from_db()
        self.assertEqual(self.recruiter.company_id, self.company.pk)

    def test_reason_is_required_and_other_actor_cannot_reuse_target_state(self):
        missing = self.client.post(
            self.endpoint('company-unlink-impact'),
            {'reason': ''},
            format='json',
        )
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)

        other = User.objects.create_user(
            email='company-unlink-other@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        RecruiterProfile.objects.create(
            user=other,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
        )
        preview = self.preview()
        response = self.client.post(
            reverse('admin-account-unlink-company', kwargs={'public_id': other.public_id}),
            {
                'reason': 'Nhà tuyển dụng xác nhận đã chọn nhầm công ty.',
                'impact_token': preview.data['impact_token'],
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

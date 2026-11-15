from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.employers.models import (
    Company,
    CompanyDocument,
    CompanyUpdateRequest,
    EmployerCompanyLinkEvent,
    EmployerVerificationCase,
    EmployerVerificationEvent,
    RecruiterProfile,
    RecruitmentNeed,
)
from apps.jobs.models import JobCategory

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

    def confirm(self, preview):
        return self.client.post(
            self.endpoint('unlink-company'),
            {
                'reason': 'Nhà tuyển dụng xác nhận đã chọn nhầm công ty.',
                'impact_token': preview.data['impact_token'],
            },
            format='json',
        )

    def test_unapproved_submissions_are_withdrawn_with_the_link(self):
        self.case.status = EmployerVerificationCase.Status.PENDING
        self.case.verification_method = (
            EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
        )
        self.case.save()
        document = CompanyDocument.objects.create(
            company=self.company,
            uploaded_by=self.employer,
            recruiter=self.recruiter,
            verification_case=self.case,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='private/company-link-proof.pdf',
        )
        update = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.employer,
            changes={'company_name': 'Tên mới'},
        )
        RecruitmentNeed.objects.create(
            recruiter=self.recruiter,
            position_category=JobCategory.objects.create(
                name='Unlink need', category_type=JobCategory.CategoryType.SPECIALIZATION
            ),
            position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
            is_continuous=True,
            headcount=1,
            budget_source=RecruitmentNeed.BudgetSource.COMPANY,
            completed_at=timezone.now(),
        )

        preview = self.preview()
        response = self.confirm(preview)

        self.assertTrue(preview.data['can_apply'], preview.data)
        self.assertEqual(preview.data['blockers'], [])
        self.assertEqual(
            preview.data['withdrawals'],
            ['VERIFICATION_CASE', 'VERIFICATION_DOCUMENTS', 'COMPANY_UPDATE_REQUESTS'],
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.case.refresh_from_db()
        document.refresh_from_db()
        update.refresh_from_db()
        self.assertEqual(self.case.status, EmployerVerificationCase.Status.DRAFT)
        self.assertIsNone(self.case.company_id)
        self.assertTrue(
            self.case.events.filter(
                event_type=EmployerVerificationEvent.EventType.WITHDRAWN_BY_UNLINK
            ).exists()
        )
        self.assertFalse(document.is_current)
        self.assertEqual(update.status, CompanyUpdateRequest.Status.CANCELLED)
        self.assertTrue(RecruitmentNeed.objects.filter(recruiter=self.recruiter).exists())

    def test_what_took_effect_for_the_company_still_blocks(self):
        self.case.status = EmployerVerificationCase.Status.APPROVED
        self.case.save(update_fields=['status', 'updated_at'])
        approved = self.preview()

        self.case.status = EmployerVerificationCase.Status.DRAFT
        self.case.save(update_fields=['status', 'updated_at'])
        self.recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        self.recruiter.save(update_fields=['company_role', 'updated_at'])
        sole_owner = self.preview()
        colleague = User.objects.create_user(
            email='company-unlink-colleague@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        RecruiterProfile.objects.create(
            user=colleague, company=self.company, company_role=RecruiterProfile.CompanyRole.MEMBER
        )
        owner_with_members = self.preview()

        self.assertEqual(approved.data['blockers'], ['VERIFICATION_APPROVED'])
        self.assertEqual(approved.data['impact_token'], '')
        self.assertTrue(sole_owner.data['can_apply'], sole_owner.data)
        self.assertEqual(owner_with_members.data['blockers'], ['COMPANY_OWNER_WITH_MEMBERS'])

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

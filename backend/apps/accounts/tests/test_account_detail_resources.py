from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.candidates.models import CandidateConsent, CandidateProfile
from apps.employers.models import (
    Company,
    CompanyImage,
    CompanyIndustry,
    Industry,
    RecruiterProfile,
)

from ..models import AdminAccessAuditLog, User


class AdminAccountDetailResourceTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='account-detail-admin@example.com',
            password='Password@123',
        )
        self.candidate = User.objects.create_user(
            email='candidate-detail@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            full_name='Ứng viên kiểm thử',
            phone='0912345678',
        )
        self.profile = CandidateProfile.objects.get(user=self.candidate)
        self.profile.date_of_birth = date(1998, 5, 12)
        self.profile.address = 'Quận Cầu Giấy, Hà Nội'
        self.profile.headline = 'Backend Engineer'
        self.profile.save(
            update_fields=[
                'date_of_birth',
                'address',
                'headline',
                'updated_at',
            ]
        )
        self.consent = CandidateConsent.objects.create(
            candidate_profile=self.profile,
            consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
            decision=CandidateConsent.Decision.GRANTED,
            policy_version='2026-01',
        )
        self.client.force_authenticate(self.admin)
        self.profile_url = reverse(
            'admin-account-profile',
            kwargs={'public_id': self.candidate.public_id},
        )

    def test_sensitive_profile_is_masked_until_explicit_reveal_and_audited(self):
        masked = self.client.get(self.profile_url)

        self.assertEqual(masked.status_code, 200, masked.data)
        self.assertNotEqual(
            masked.data['candidate']['date_of_birth'],
            self.profile.date_of_birth.isoformat(),
        )
        self.assertNotEqual(masked.data['candidate']['address'], self.profile.address)
        self.assertFalse(
            AdminAccessAuditLog.objects.filter(action='reveal_account_sensitive_profile').exists()
        )

        revealed = self.client.get(self.profile_url, {'reveal': 'true'})

        self.assertEqual(revealed.status_code, 200, revealed.data)
        self.assertEqual(
            revealed.data['candidate']['date_of_birth'],
            self.profile.date_of_birth,
        )
        self.assertEqual(revealed.data['candidate']['address'], self.profile.address)
        self.assertTrue(
            AdminAccessAuditLog.objects.filter(
                action='reveal_account_sensitive_profile',
                target_public_id=self.candidate.public_id,
            ).exists()
        )

    def test_safe_profile_patch_does_not_modify_candidate_consent(self):
        response = self.client.patch(
            self.profile_url,
            {
                'headline': 'Senior Backend Engineer',
                'consent_type': CandidateConsent.ConsentType.RECRUITER_VISIBILITY,
                'decision': CandidateConsent.Decision.DENIED,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.profile.refresh_from_db()
        self.consent.refresh_from_db()
        self.assertEqual(self.profile.headline, 'Senior Backend Engineer')
        self.assertEqual(self.consent.decision, CandidateConsent.Decision.GRANTED)
        self.assertEqual(self.profile.consents.count(), 1)

    def test_consent_subresource_uses_paginated_contract(self):
        response = self.client.get(
            reverse(
                'admin-account-consents',
                kwargs={'public_id': self.candidate.public_id},
            )
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            response.data['results'][0]['consent_type'],
            CandidateConsent.ConsentType.AI_RECOMMENDATION,
        )

    def test_employer_company_profile_includes_complete_media_and_metadata(self):
        employer = User.objects.create_user(
            email='employer-company-detail@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            full_name='Nhà tuyển dụng kiểm thử',
        )
        company = Company.objects.create(
            company_name='Công ty đầy đủ',
            trade_name='Thương hiệu đầy đủ',
            trade_name_same_as_registered=False,
            tax_code='0107777777',
            logo_url='employers/company/logo.png',
            cover_image_url='employers/company/cover.png',
            website_url='https://example.com',
            email='contact@example.com',
            phone='0901234567',
            address='Đà Nẵng',
            company_size=Company.Size.S100_499,
            founded_year=2015,
            has_brand_page=True,
            created_by=employer,
        )
        industry = Industry.objects.create(name='Công nghệ kiểm thử tab công ty')
        CompanyIndustry.objects.create(
            company=company,
            industry=industry,
            is_primary=True,
        )
        CompanyImage.objects.create(
            company=company,
            image_url='employers/company/office.png',
            caption='Văn phòng chính',
        )
        recruiter, _ = RecruiterProfile.objects.get_or_create(user=employer)
        recruiter.company = company
        recruiter.save(update_fields=['company', 'updated_at'])

        response = self.client.get(
            reverse('admin-account-profile', kwargs={'public_id': employer.public_id})
        )

        self.assertEqual(response.status_code, 200, response.data)
        company_data = response.data['employer']['company']
        self.assertEqual(company_data['public_id'], company.public_id)
        self.assertEqual(company_data['primary_industry'], industry.name)
        self.assertEqual(company_data['created_by_email'], employer.email)
        self.assertEqual(
            company_data['logo_url'],
            'http://testserver/media/employers/company/logo.png',
        )
        self.assertEqual(
            company_data['cover_image_url'],
            'http://testserver/media/employers/company/cover.png',
        )
        self.assertEqual(company_data['images'][0]['caption'], 'Văn phòng chính')
        self.assertEqual(
            company_data['images'][0]['image_url'],
            'http://testserver/media/employers/company/office.png',
        )

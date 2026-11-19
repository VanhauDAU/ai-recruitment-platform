"""Admin review of company update requests and their proof."""

from django.urls import reverse
from django.utils import timezone

from apps.accounts.tests.factories import make_admin

from ..models import (
    Company,
    CompanyDocument,
    CompanyIndustry,
    CompanyTaxLookupEvidence,
    CompanyUpdateRequest,
    Industry,
)
from .cases import AdminVerificationTestCase


class AdminCompanyUpdateReviewTests(AdminVerificationTestCase):
    def test_regular_admin_reviews_company_updates_and_verification(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'website_url': 'https://example.com/new'},
        )
        self.client.force_authenticate(make_admin())

        company_queue = self.client.get(reverse('admin-company-update-request-list'))
        account_detail = self.client.get(
            reverse('admin-account-detail', kwargs={'public_id': self.first_user.public_id})
        )
        verification_queue = self.client.get(reverse('admin-employer-verification-list'))

        self.assertEqual(company_queue.status_code, 200, company_queue.data)
        self.assertEqual(account_detail.status_code, 200, account_detail.data)
        self.assertEqual(verification_queue.status_code, 200, verification_queue.data)

        started = self.client.post(
            reverse(
                'admin-company-update-request-start-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {'lock_version': update_request.lock_version},
            format='json',
        )
        self.assertEqual(started.status_code, 200, started.data)
        accepted_review = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.REJECTED,
                'note': 'Chưa đủ thông tin.',
                'lock_version': started.data['lock_version'],
                'revision_public_id': started.data['current_revision_public_id'],
            },
            format='json',
        )

        self.assertEqual(accepted_review.status_code, 200, accepted_review.data)
        update_request.refresh_from_db()
        self.assertEqual(update_request.status, CompanyUpdateRequest.Status.REJECTED)

    def test_regular_admin_sees_company_update_document_metadata(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'address': 'Địa chỉ mới'},
            submitted_at=timezone.now(),
        )
        document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/private/company-update.pdf',
            file_name='dang-ky-kinh-doanh.pdf',
            mime_type='application/pdf',
            file_size=2048,
            sha256='a' * 64,
        )
        website_document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.TRADE_NAME_PROOF,
            file_url='https://evidence.example/private-reference',
            file_name='Website chứng minh tên thương mại',
        )
        self.client.force_authenticate(make_admin())

        revealed_detail = self.client.get(
            reverse(
                'admin-company-update-request-detail',
                kwargs={'public_id': update_request.public_id},
            )
        )

        self.assertEqual(revealed_detail.status_code, 200, revealed_detail.data)
        revealed_documents = {item['public_id']: item for item in revealed_detail.data['documents']}
        revealed = revealed_documents[document.public_id]
        self.assertEqual(revealed['file_name'], 'dang-ky-kinh-doanh.pdf')
        self.assertEqual(revealed['mime_type'], 'application/pdf')
        self.assertEqual(revealed['file_size'], 2048)
        self.assertEqual(revealed['sha256'], 'a' * 64)
        self.assertEqual(revealed['uploaded_by_email'], self.first_user.email)
        self.assertEqual(
            revealed_documents[website_document.public_id]['source_url'],
            'https://evidence.example/private-reference',
        )

    def test_company_update_document_action_is_scoped_to_exact_request(self):
        other_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.second_user,
            changes={'address': 'Địa chỉ của thành viên khác'},
        )
        other_document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.second,
            uploaded_by=self.second_user,
            update_request=other_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/private/other-company-update.pdf',
        )
        first_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'address': 'Địa chỉ của thành viên đầu tiên'},
        )
        first_request = self._put_company_update_in_review(first_request)
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review-document',
                kwargs={
                    'public_id': first_request.public_id,
                    'document_public_id': other_document.public_id,
                },
            ),
            {
                'decision': CompanyDocument.Status.APPROVED,
                'reason': '',
                'lock_version': first_request.lock_version,
                'revision_public_id': first_request.current_revision.public_id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 404, response.data)
        other_document.refresh_from_db()
        self.assertEqual(other_document.status, CompanyDocument.Status.PENDING)

    def test_admin_reviews_company_update_proof_before_applying_change(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'company_name': 'Công ty dùng chung mới'},
            is_sensitive=True,
            reason='Đổi tên theo đăng ký doanh nghiệp',
            proof_type=CompanyUpdateRequest.ProofType.BUSINESS_REGISTRATION,
        )
        document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/update-requests/business-registration.pdf',
            file_name='business-registration.pdf',
            mime_type='application/pdf',
        )
        update_request = self._put_company_update_in_review(update_request)
        self.client.force_authenticate(self.admin)

        document_response = self.client.post(
            reverse(
                'admin-company-update-request-review-document',
                kwargs={
                    'public_id': update_request.public_id,
                    'document_public_id': document.public_id,
                },
            ),
            {
                'decision': CompanyDocument.Status.APPROVED,
                'reason': '',
                'lock_version': update_request.lock_version,
                'revision_public_id': update_request.current_revision.public_id,
            },
            format='json',
        )
        self.assertEqual(document_response.status_code, 200, document_response.data)
        self.assertEqual(
            document_response.data['lock_version'],
            update_request.lock_version + 1,
        )

        review_response = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.APPROVED,
                'note': '',
                'lock_version': document_response.data['lock_version'],
                'revision_public_id': document_response.data['current_revision_public_id'],
            },
            format='json',
        )

        self.assertEqual(review_response.status_code, 200, review_response.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.company_name, 'Công ty dùng chung mới')

    def test_duplicate_company_tax_code_does_not_block_company_update(self):
        existing_company = Company.objects.create(
            company_name='Công ty đã dùng mã số thuế',
            tax_code='0402189757',
            created_by=self.second_user,
        )
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'tax_code': existing_company.tax_code},
            is_sensitive=True,
            reason='Đổi mã số thuế theo đăng ký doanh nghiệp',
            proof_type=CompanyUpdateRequest.ProofType.BUSINESS_REGISTRATION,
        )
        CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/update-requests/duplicate-tax-code.pdf',
            file_name='duplicate-tax-code.pdf',
            mime_type='application/pdf',
            status=CompanyDocument.Status.APPROVED,
        )
        update_request = self._put_company_update_in_review(update_request)
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.APPROVED,
                'note': '',
                'lock_version': update_request.lock_version,
                'revision_public_id': update_request.current_revision.public_id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.company.refresh_from_db()
        existing_company.refresh_from_db()
        update_request.refresh_from_db()
        self.assertEqual(self.company.tax_code, '0402189757')
        self.assertEqual(existing_company.tax_code, '0402189757')
        self.assertEqual(update_request.status, CompanyUpdateRequest.Status.APPROVED)

    def test_employer_sees_company_update_rejection_reason(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'website_url': 'https://example.com/new'},
        )
        update_request = self._put_company_update_in_review(update_request)
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.REJECTED,
                'note': 'Không liên hệ được khách hàng.',
                'lock_version': update_request.lock_version,
                'revision_public_id': update_request.current_revision.public_id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.client.force_authenticate(self.first_user)
        employer_response = self.client.get(reverse('employer-company-update-requests'))

        self.assertEqual(employer_response.status_code, 200, employer_response.data)
        employer_request = next(
            item for item in employer_response.data if item['public_id'] == update_request.public_id
        )
        self.company.refresh_from_db()
        self.assertEqual(employer_request['status'], CompanyUpdateRequest.Status.REJECTED)
        self.assertEqual(
            employer_request['rejection_reason'],
            'Không liên hệ được khách hàng.',
        )
        self.assertEqual(self.company.website_url, '')

    def test_admin_can_refresh_company_update_tax_lookup(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'company_name': 'Công ty dùng chung mới'},
            is_sensitive=True,
            reason='Đổi tên theo đăng ký doanh nghiệp',
            proof_type=CompanyUpdateRequest.ProofType.BUSINESS_REGISTRATION,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-refresh-tax-lookup',
                kwargs={'public_id': update_request.public_id},
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['lock_version'], 1)
        self.assertEqual(response.data['tax_lookup_evidence']['status'], 'pending')
        evidence = CompanyTaxLookupEvidence.objects.get(update_request=update_request)
        self.assertEqual(evidence.workflow_revision, update_request.revision)
        self.assertEqual(evidence.submitted_company_name, 'Công ty dùng chung mới')

    def test_employer_sees_company_update_document_revision_request(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'company_name': 'Công ty dùng chung mới'},
            is_sensitive=True,
            reason='Đổi tên theo đăng ký doanh nghiệp',
            proof_type=CompanyUpdateRequest.ProofType.BUSINESS_REGISTRATION,
        )
        document = CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.first,
            uploaded_by=self.first_user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url='employers/update-requests/business-registration.pdf',
            file_name='business-registration.pdf',
            mime_type='application/pdf',
        )
        update_request = self._put_company_update_in_review(update_request)
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review-document',
                kwargs={
                    'public_id': update_request.public_id,
                    'document_public_id': document.public_id,
                },
            ),
            {
                'decision': CompanyDocument.Status.CHANGES_REQUESTED,
                'reason': 'Ảnh chụp bị mờ, vui lòng tải bản rõ đủ bốn góc.',
                'lock_version': update_request.lock_version,
                'revision_public_id': update_request.current_revision.public_id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.client.force_authenticate(self.first_user)
        employer_response = self.client.get(reverse('employer-company-update-requests'))
        current_document = employer_response.data[0]['documents'][0]
        self.assertEqual(current_document['status'], CompanyDocument.Status.CHANGES_REQUESTED)
        self.assertEqual(current_document['status_label'], 'Cần bổ sung')
        self.assertEqual(current_document['doc_type_label'], 'Giấy đăng ký doanh nghiệp')
        self.assertEqual(
            current_document['review_note'],
            'Ảnh chụp bị mờ, vui lòng tải bản rõ đủ bốn góc.',
        )

    def test_admin_company_update_includes_current_values_for_comparison(self):
        current_industry = Industry.objects.create(name='Lĩnh vực hiện tại đối chiếu')
        proposed_industry = Industry.objects.create(name='Lĩnh vực đề xuất đối chiếu')
        CompanyIndustry.objects.create(
            company=self.company,
            industry=current_industry,
            is_primary=True,
        )
        CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={
                'company_name': 'Công ty dùng chung mới',
                'industries': [proposed_industry.id],
                'primary_industry': proposed_industry.id,
                'gallery_additions': ['employers/company/gallery/proposed.jpg'],
            },
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse('admin-company-update-request-list'))

        self.assertEqual(response.status_code, 200, response.data)
        request_data = response.data['results'][0]
        self.assertEqual(request_data['current_values']['company_name'], 'Công ty dùng chung')
        self.assertEqual(request_data['current_values']['industries'], [current_industry.id])
        self.assertEqual(
            request_data['current_values']['primary_industry'],
            current_industry.id,
        )
        self.assertEqual(
            request_data['industry_labels'][str(proposed_industry.id)],
            'Lĩnh vực đề xuất đối chiếu',
        )
        self.assertEqual(
            request_data['media_previews']['gallery_additions'],
            ['http://testserver/media/employers/company/gallery/proposed.jpg'],
        )

    def test_stale_company_update_review_returns_conflict(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'website_url': 'https://example.com/new'},
            status=CompanyUpdateRequest.Status.IN_REVIEW,
            lock_version=2,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.APPROVED,
                'note': '',
                'lock_version': 1,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 409, response.data)
        update_request.refresh_from_db()
        self.assertEqual(update_request.status, CompanyUpdateRequest.Status.IN_REVIEW)

    def test_admin_cannot_approve_legacy_short_company_description(self):
        original_description = self.company.description
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.first_user,
            changes={'description': f'<p>{"A" * 499}</p>'},
        )
        update_request = self._put_company_update_in_review(update_request)
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse(
                'admin-company-update-request-review',
                kwargs={'public_id': update_request.public_id},
            ),
            {
                'decision': CompanyUpdateRequest.Status.APPROVED,
                'note': '',
                'lock_version': update_request.lock_version,
                'revision_public_id': update_request.current_revision.public_id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('description', response.data)
        self.company.refresh_from_db()
        update_request.refresh_from_db()
        self.assertEqual(self.company.description, original_description)
        self.assertEqual(update_request.status, CompanyUpdateRequest.Status.IN_REVIEW)

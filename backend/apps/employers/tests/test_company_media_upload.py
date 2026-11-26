"""Company logo, cover and gallery uploads staged on update requests."""

import io
import shutil

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from common.storage.r2 import public_media_storage

from .. import services
from ..models import (
    Company,
    CompanyImage,
    CompanyUpdateRequest,
    EmployerVerificationCase,
    RecruiterProfile,
)
from .factories import (
    PNG_BYTES,
    TEST_MEDIA_ROOT,
    authenticate_employer,
    make_recruiter,
)


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, ALLOWED_HOSTS=['testserver'])
class CompanyImageUploadTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.user, self.recruiter = make_recruiter()
        self.company = Company.objects.create(company_name='Acme', created_by=self.user)
        self.recruiter.company = self.company
        self.recruiter.company_role = RecruiterProfile.CompanyRole.OWNER
        self.recruiter.save()
        authenticate_employer(self.client, self.user)

    def test_owner_can_upload_company_logo_to_media_storage(self):
        upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(
            reverse('employer-company-logo-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('/media/employers/', response.data['logo_url'])
        self.company.refresh_from_db()
        self.assertTrue(self.company.logo_url.startswith('employers/'))
        self.assertNotIn('://', self.company.logo_url)
        self.assertFalse(self.company.has_no_logo)

    def test_logo_is_downscaled_more_than_the_cover(self):
        buffer = io.BytesIO()
        Image.new('RGB', (2000, 1000), 'navy').save(buffer, format='PNG')

        for name, kind, expected in (
            ('employer-company-logo-upload', 'logo_url', (800, 400)),
            ('employer-company-cover-upload', 'cover_image_url', (2000, 1000)),
        ):
            upload = SimpleUploadedFile('big.png', buffer.getvalue(), content_type='image/png')
            response = self.client.post(reverse(name), {'file': upload}, format='multipart')
            self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
            self.company.refresh_from_db()
            with public_media_storage().open(getattr(self.company, kind)) as stored:
                self.assertEqual(Image.open(stored).size, expected)

    def test_owner_can_upload_company_logo(self):
        upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')

        response = self.client.post(
            reverse('employer-company-logo-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_gallery_rejects_the_eleventh_image(self):
        CompanyImage.objects.bulk_create(
            [
                CompanyImage(
                    company=self.company, image_url=f'employers/image-{index}.png', sort_order=index
                )
                for index in range(10)
            ]
        )
        upload = SimpleUploadedFile('extra.png', PNG_BYTES, content_type='image/png')

        response = self.client.post(
            reverse('employer-company-image-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.company.images.count(), 10)

    def test_edit_logo_is_staged_until_the_update_request_is_approved(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.user,
            changes={'logo_pending': True},
        )
        upload = SimpleUploadedFile('new-logo.png', PNG_BYTES, content_type='image/png')

        response = self.client.post(
            reverse('employer-company-logo-upload'),
            {
                'file': upload,
                'update_request': update_request.public_id,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.logo_url, '')
        update_request.refresh_from_db()
        self.assertIn('logo_url', update_request.changes)
        self.assertNotIn('logo_pending', update_request.changes)

        admin = User.objects.create_superuser(
            email='media-reviewer@example.com',
            password='Password@123',
        )
        update_request = services.start_company_update_review(
            update_request,
            actor=admin,
            lock_version=update_request.lock_version,
            revision_public_id=update_request.current_revision.public_id,
        )
        services.apply_update_request(
            update_request,
            admin,
            approve=True,
            lock_version=update_request.lock_version,
            revision_public_id=update_request.current_revision.public_id,
        )
        self.company.refresh_from_db()
        self.assertEqual(self.company.logo_url, update_request.changes['logo_url'])

    def test_pending_gallery_upload_is_returned_for_the_next_edit(self):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.user,
            changes={'gallery_pending': True},
        )
        upload = SimpleUploadedFile('office.png', PNG_BYTES, content_type='image/png')

        upload_response = self.client.post(
            reverse('employer-company-image-upload'),
            {
                'file': upload,
                'update_request': update_request.public_id,
            },
            format='multipart',
        )
        list_response = self.client.get(reverse('employer-company-update-requests'))

        self.assertEqual(upload_response.status_code, status.HTTP_200_OK, upload_response.data)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK, list_response.data)
        pending = next(
            item for item in list_response.data if item['public_id'] == update_request.public_id
        )
        self.assertEqual(len(pending['changes']['gallery_additions']), 1)
        self.assertEqual(len(pending['media_previews']['gallery_additions']), 1)
        self.assertIn('/media/employers/', pending['media_previews']['gallery_additions'][0])

    def test_direct_media_edit_is_blocked_after_verification_was_submitted(self):
        EmployerVerificationCase.objects.create(
            recruiter=self.recruiter,
            company=self.company,
            status=EmployerVerificationCase.Status.PENDING,
        )
        upload = SimpleUploadedFile('bypass.png', PNG_BYTES, content_type='image/png')

        response = self.client.post(
            reverse('employer-company-logo-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('update_request', response.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.logo_url, '')

    def test_member_cannot_upload_logo(self):
        member, member_recruiter = make_recruiter('member@example.com')
        member_recruiter.company = self.company
        member_recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        member_recruiter.save()
        authenticate_employer(self.client, member)

        upload = SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(
            reverse('employer-company-logo-upload'), {'file': upload}, format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_cannot_mutate_media_on_a_members_update_request(self):
        member, member_recruiter = make_recruiter('media-request-owner@example.com')
        member_recruiter.company = self.company
        member_recruiter.company_role = RecruiterProfile.CompanyRole.MEMBER
        member_recruiter.save(update_fields=['company', 'company_role', 'updated_at'])
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=member,
            changes={'logo_pending': True},
            submitted_at=timezone.now(),
        )

        response = self.client.post(
            reverse('employer-company-logo-upload'),
            {
                'file': SimpleUploadedFile('logo.png', PNG_BYTES, content_type='image/png'),
                'update_request': update_request.public_id,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        update_request.refresh_from_db()
        self.assertEqual(update_request.changes, {'logo_pending': True})

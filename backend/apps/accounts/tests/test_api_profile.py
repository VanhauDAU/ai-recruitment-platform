"""Tầng HTTP: avatar, hồ sơ cá nhân và đổi email."""

import shutil
from io import BytesIO

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from common.storage.r2 import public_media_storage

from ..models import AuthEmailJob, SocialAccount, User
from ..tasks import deliver_auth_email_job
from .factories import PNG_BYTES, TEST_MEDIA_ROOT


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, ALLOWED_HOSTS=['testserver'])
class AvatarUploadTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def test_authenticated_user_can_upload_avatar_to_media_storage(self):
        user = User.objects.create_user(email='candidate@example.com', password='Password@123')
        self.client.force_authenticate(user=user)

        upload = SimpleUploadedFile('avatar.png', PNG_BYTES, content_type='image/png')
        response = self.client.post(
            reverse('auth-avatar-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('/media/users/avatars/', response.data['avatar_url'])
        user.refresh_from_db()
        self.assertTrue(user.avatar_url.startswith('users/avatars/'))
        self.assertNotIn('://', user.avatar_url)

    def test_upload_rejects_non_image_payload(self):
        user = User.objects.create_user(email='candidate@example.com', password='Password@123')
        self.client.force_authenticate(user=user)

        upload = SimpleUploadedFile('avatar.png', b'not an image', content_type='image/png')
        response = self.client.post(
            reverse('auth-avatar-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertEqual(user.avatar_url, '')

    def test_upload_downscales_oversized_avatar(self):
        buffer = BytesIO()
        Image.new('RGB', (2000, 1500), 'white').save(buffer, format='JPEG')
        user = User.objects.create_user(email='candidate@example.com', password='Password@123')
        self.client.force_authenticate(user=user)

        upload = SimpleUploadedFile('avatar.jpg', buffer.getvalue(), content_type='image/jpeg')
        response = self.client.post(
            reverse('auth-avatar-upload'), {'file': upload}, format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        with public_media_storage().open(user.avatar_url) as stored, Image.open(stored) as image:
            self.assertLessEqual(max(image.size), 1024)

    def test_delete_avatar_clears_field_and_removes_file(self):
        user = User.objects.create_user(email='candidate@example.com', password='Password@123')
        self.client.force_authenticate(user=user)
        upload = SimpleUploadedFile('avatar.png', PNG_BYTES, content_type='image/png')
        self.client.post(reverse('auth-avatar-upload'), {'file': upload}, format='multipart')
        user.refresh_from_db()
        stored_path = user.avatar_url

        response = self.client.delete(reverse('auth-avatar-upload'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['avatar_url'], '')
        user.refresh_from_db()
        self.assertEqual(user.avatar_url, '')
        self.assertFalse(public_media_storage().exists(stored_path))

    def test_delete_avatar_requires_authentication(self):
        response = self.client.delete(reverse('auth-avatar-upload'))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProfileUpdateTests(APITestCase):
    """PATCH /auth/me/: sửa họ tên + SĐT nhiều lần, email không đổi."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='candidate@example.com',
            password='Password@123',
            full_name='Tên Cũ',
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse('auth-me')

    def test_update_name_and_phone(self):
        response = self.client.patch(self.url, {'full_name': 'Lê Văn Hậu', 'phone': '0912345678'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['full_name'], 'Lê Văn Hậu')
        self.assertEqual(response.data['phone'], '0912345678')
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, 'Lê Văn Hậu')
        self.assertEqual(self.user.phone, '0912345678')

    def test_me_response_contains_session_fields_only(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data),
            {
                'public_id',
                'email',
                'role',
                'full_name',
                'phone',
                'avatar_url',
                'email_verified',
                'job_preferences_configured',
                'has_usable_password',
                'employer_onboarding_required',
                'employer_onboarding_step',
                'employer_verification_completed',
                'employer_job_workspace_ready',
                'admin_access',
            },
        )
        self.assertIsNone(response.data['admin_access'])
        self.assertIs(response.data['job_preferences_configured'], False)
        self.assertIs(response.data['has_usable_password'], True)
        self.assertIs(response.data['employer_verification_completed'], False)
        self.assertIs(response.data['employer_job_workspace_ready'], False)
        self.assertTrue(
            {
                'id',
                'password',
                'token',
                'refresh_token',
                'permissions',
                'status',
                'date_joined',
                'last_login',
            }.isdisjoint(response.data)
        )

    def test_can_update_multiple_times(self):
        self.client.patch(self.url, {'full_name': 'Lần 1', 'phone': '0900000001'})
        response = self.client.patch(self.url, {'full_name': 'Lần 2', 'phone': '0900000002'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, 'Lần 2')
        self.assertEqual(self.user.phone, '0900000002')

    def test_email_is_read_only(self):
        response = self.client.patch(
            self.url,
            {'full_name': 'Ai Đó', 'email': 'hacker@evil.com'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'candidate@example.com')

    def test_invalid_phone_rejected(self):
        response = self.client.patch(self.url, {'full_name': 'Hợp Lệ', 'phone': 'abc'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', response.data)

    def test_blank_name_rejected(self):
        response = self.client.patch(self.url, {'full_name': '   '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('full_name', response.data)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.patch(self.url, {'full_name': 'X'})
        self.assertIn(response.status_code, (401, 403))

    def test_employer_cannot_bypass_sms_when_changing_phone(self):
        employer = User.objects.create_user(
            email='employer-phone-change@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            full_name='Nhà tuyển dụng',
            phone='0912345678',
        )
        self.client.force_authenticate(user=employer)

        response = self.client.patch(
            self.url,
            {'full_name': 'Nhà tuyển dụng', 'phone': '0987654321'},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', response.data)
        employer.refresh_from_db()
        self.assertEqual(employer.phone, '0912345678')


class ChangeEmailTests(APITestCase):
    def setUp(self):
        cache.clear()

    def _user(self):
        return User.objects.create_user(email='pending@example.com', password='Password@123')

    def test_change_email_requires_current_password(self):
        user = self._user()
        self.client.force_authenticate(user=user)

        wrong = self.client.post(
            reverse('auth-change-email'),
            {
                'email': 'new@example.com',
                'current_password': 'Wrong@123',
            },
            format='json',
        )

        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', wrong.data)
        user.refresh_from_db()
        self.assertEqual(user.email, 'pending@example.com')

    def test_change_email_rejected_when_already_verified(self):
        user = self._user()
        user.email_verified = True
        user.save(update_fields=['email_verified'])
        self.client.force_authenticate(user=user)

        response = self.client.post(
            reverse('auth-change-email'),
            {
                'email': 'new@example.com',
                'current_password': 'Password@123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertEqual(user.email, 'pending@example.com')

    def test_change_email_success_resets_verification_and_warns_old_address(self):
        user = self._user()
        self.client.force_authenticate(user=user)

        response = self.client.post(
            reverse('auth-change-email'),
            {
                'email': 'new@example.com',
                'current_password': 'Password@123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        user.refresh_from_db()
        self.assertEqual(user.email, 'new@example.com')
        self.assertFalse(user.email_verified)
        notice = AuthEmailJob.objects.get(
            user=user,
            kind=AuthEmailJob.Kind.EMAIL_CHANGED_NOTICE,
        )
        self.assertEqual(notice.context['recipient'], 'pending@example.com')
        deliver_auth_email_job.run(notice.pk)
        # Mail cảnh báo từ outbox phải tới đúng địa chỉ CŨ.
        warning = [msg for msg in mail.outbox if 'pending@example.com' in msg.to]
        self.assertEqual(len(warning), 1)
        self.assertIn('thay đổi', warning[0].subject.lower())

    def test_change_email_rejects_address_owned_by_another_oauth_account(self):
        oauth_user = User.objects.create_user(
            email='oauth-current@example.com',
            password=None,
            role=User.Role.CANDIDATE,
        )
        SocialAccount.objects.create(
            user=oauth_user,
            provider=User.Provider.GOOGLE,
            provider_user_id='google-reserved-email',
            email='oauth-original@example.com',
        )
        user = self._user()
        self.client.force_authenticate(user=user)

        response = self.client.post(
            reverse('auth-change-email'),
            {
                'email': 'OAUTH-ORIGINAL@example.com',
                'current_password': 'Password@123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        user.refresh_from_db()
        self.assertEqual(user.email, 'pending@example.com')

"""CV ứng viên trong cổng admin (CVT-4): metadata, xem nội dung có lý do, khóa CV."""

from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient

from apps.cv_templates.tests.test_admin_portal import make_admin

from ..models import CvAccessLog, CvSharedLink, UserCv
from ..services.sharing import (
    CvSharePermissionError,
    CvShareUnavailableError,
    create_shared_link,
    resolve_shared_link,
)
from ..services.versions import create_initial_document


class AdminUserCvApiTests(TestCase):
    def setUp(self):
        self.candidate = get_user_model().objects.create_user(
            email='admin-view-candidate@example.com', password='password', role='candidate'
        )
        self.candidate.email_verified = True
        self.candidate.save(update_fields=['email_verified'])
        self.cv = UserCv.objects.create(
            user=self.candidate,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='CV bí mật',
        )
        create_initial_document(self.cv, self.candidate)
        self.cv.refresh_from_db()
        self.client = APIClient()
        self.url = f'/api/v2/admin/user-cvs/{self.cv.public_id}/'

    def test_metadata_list_never_exposes_email_or_content(self):
        self.client.force_authenticate(make_admin('cv-meta@example.com', 'cv_user.view'))

        response = self.client.get('/api/v2/admin/user-cvs/', {'source': 'builder'})

        self.assertEqual(response.status_code, 200)
        row = response.data['results'][0]
        self.assertEqual(row['candidate_public_id'], self.candidate.public_id)
        self.assertNotIn('admin-view-candidate@example.com', str(response.data))
        self.assertNotIn('content_json', row)
        self.assertEqual(
            self.client.post(f'{self.url}content/', {'reason': 'Hỗ trợ ứng viên #123'}).status_code,
            403,
        )

    def test_viewing_content_requires_a_reason_and_is_audited(self):
        admin = make_admin('cv-content@example.com', 'cv_user.view', 'cv_user.view_content')
        self.client.force_authenticate(admin)

        missing = self.client.post(f'{self.url}content/', {'reason': 'ngắn'})
        viewed = self.client.post(f'{self.url}content/', {'reason': 'Xử lý khiếu nại số 4521'})

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(viewed.status_code, 200, viewed.data)
        self.assertEqual(viewed['Cache-Control'], 'private, no-store')
        self.assertIn('content_json', viewed.data['document'])
        log = CvAccessLog.objects.get(cv=self.cv)
        self.assertEqual(
            (log.actor_user, log.actor_type, log.reason),
            (admin, CvAccessLog.ActorType.ADMIN, 'Xử lý khiếu nại số 4521'),
        )

    def test_locking_revokes_and_blocks_public_sharing(self):
        link, token = create_shared_link(cv=self.cv, actor=self.candidate)
        self.client.force_authenticate(
            make_admin('cv-lock@example.com', 'cv_user.view', 'cv_user.view_content')
        )

        locked = self.client.post(f'{self.url}lock/', {'reason': 'Nội dung vi phạm điều khoản'})

        self.assertEqual(locked.status_code, 200, locked.data)
        self.assertTrue(locked.data['is_locked'])
        link.refresh_from_db()
        self.assertIsNotNone(link.revoked_at)
        request = RequestFactory().get('/')
        with self.assertRaises(CvShareUnavailableError):
            resolve_shared_link(raw_token=token, request=request)
        with self.assertRaises(CvSharePermissionError):
            create_shared_link(cv=self.cv, actor=self.candidate)

        unlocked = self.client.post(f'{self.url}unlock/')
        self.assertFalse(unlocked.data['is_locked'])
        new_link, _ = create_shared_link(cv=self.cv, actor=self.candidate)
        self.assertIsInstance(new_link, CvSharedLink)

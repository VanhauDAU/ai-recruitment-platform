import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.cv_templates.models import CvTemplate


TEST_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class CandidateCvApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='candidate-cv@example.com',
            password='password',
            role='candidate',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def test_upload_uses_cv_service_and_keeps_storage_key(self):
        upload = SimpleUploadedFile('my-cv.pdf', b'%PDF-1.4 test', content_type='application/pdf')

        response = self.client.post('/api/cvs/upload/', {'file': upload, 'title': 'My CV'}, format='multipart')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['title'], 'My CV')
        self.assertTrue(response.data['file_url'].endswith('.pdf'))

    def test_builder_cv_creation_uses_authenticated_candidate(self):
        template = CvTemplate.objects.create(name='Standard')

        response = self.client.post('/api/cvs/', {'template': template.pk, 'title': 'Builder CV'}, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['cv_type'], 'builder')
        self.assertEqual(response.data['source'], 'builder')

# Create your tests here.

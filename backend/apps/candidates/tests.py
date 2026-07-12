from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient


class CandidateProfileApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='candidate@example.com',
            password='password',
            role='candidate',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_profile_is_owned_by_request_user_and_updates_through_service(self):
        response = self.client.get('/api/candidate/profile/')
        self.assertEqual(response.status_code, 200)

        response = self.client.patch(
            '/api/candidate/profile/',
            {'headline': 'Backend engineer', 'experience_years': '3.5'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['headline'], 'Backend engineer')
        self.assertEqual(str(response.data['experience_years']), '3.5')

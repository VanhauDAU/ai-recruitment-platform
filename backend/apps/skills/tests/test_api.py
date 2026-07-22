from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.skills.models import Skill


class SkillCreateApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='skill-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )

    def test_employer_can_create_a_skill_and_it_is_listed_for_later_lookups(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(reverse('skill-list'), {'name': 'Python'}, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['name'], 'Python')
        self.assertTrue(Skill.objects.filter(name='Python').exists())

        lookup = self.client.get(reverse('skill-list'), {'search': 'python'})

        self.assertEqual(lookup.status_code, 200)
        self.assertEqual([item['name'] for item in lookup.data], ['Python'])

    def test_reuses_existing_skill_without_creating_a_duplicate(self):
        Skill.objects.create(name='Python')
        self.client.force_authenticate(self.user)

        response = self.client.post(reverse('skill-list'), {'name': ' python '}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Python')
        self.assertEqual(Skill.objects.filter(normalized_name='python').count(), 1)

    def test_only_employers_can_create_a_skill(self):
        response = self.client.post(reverse('skill-list'), {'name': 'Python'}, format='json')

        self.assertEqual(response.status_code, 401)

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.skills.models import Skill, SkillGroup
from apps.skills.selectors.lookup import LOOKUP_CAP


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

    def test_candidate_cannot_create_a_skill(self):
        candidate = User.objects.create_user(
            email='skill-candidate@example.com', password='Password@123'
        )
        self.client.force_authenticate(candidate)

        response = self.client.post(reverse('skill-list'), {'name': 'Python'}, format='json')

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Skill.objects.filter(normalized_name='python').exists())

    def test_name_is_required_and_collapsed_before_validation(self):
        self.client.force_authenticate(self.user)

        too_short = self.client.post(reverse('skill-list'), {'name': ' a '}, format='json')
        missing = self.client.post(reverse('skill-list'), {}, format='json')
        created = self.client.post(
            reverse('skill-list'), {'name': '  Machine   Learning '}, format='json'
        )

        self.assertEqual(too_short.status_code, 400)
        self.assertIn('name', too_short.data)
        self.assertEqual(missing.status_code, 400)
        self.assertIn('name', missing.data)
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['name'], 'Machine Learning')
        self.assertEqual(created.data['slug'], 'machine-learning')


class SkillLookupApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.engineering = SkillGroup.objects.create(name='Zz Kỹ thuật')
        cls.backend = SkillGroup.objects.create(name='Zz Backend', parent=cls.engineering)
        cls.hidden_group = SkillGroup.objects.create(name='Zz Ẩn', is_active=False)
        cls.django = Skill.objects.create(
            name='Zz Django', group=cls.backend, aliases=['zz-django-framework']
        )
        cls.fastapi = Skill.objects.create(name='Zz FastAPI', group=cls.backend)
        cls.ungrouped = Skill.objects.create(name='Zz Giao tiếp')
        Skill.objects.create(name='Zz Cobol', group=cls.backend, is_active=False)

    def test_search_returns_active_skills_with_their_group_name(self):
        response = self.client.get(reverse('skill-list'), {'search': 'zz '})

        self.assertEqual(response.status_code, 200)
        by_name = {item['name']: item for item in response.data}
        self.assertEqual(set(by_name), {'Zz Django', 'Zz FastAPI', 'Zz Giao tiếp'})
        self.assertEqual(
            by_name['Zz Django'],
            {
                'id': self.django.pk,
                'name': 'Zz Django',
                'slug': 'zz-django',
                'aliases': ['zz-django-framework'],
                'group': self.backend.pk,
                'group_name': 'Zz Backend',
            },
        )
        self.assertEqual(by_name['Zz Giao tiếp']['group_name'], '')

    def test_group_filter_limits_results_to_that_group(self):
        response = self.client.get(reverse('skill-list'), {'group': self.backend.pk})

        self.assertEqual(
            [item['name'] for item in response.data],
            ['Zz Django', 'Zz FastAPI'],
        )

    def test_malformed_group_filter_matches_nothing_instead_of_failing(self):
        response = self.client.get(reverse('skill-list'), {'group': 'abc'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_lookup_is_capped(self):
        Skill.objects.bulk_create(
            Skill(name=f'Bulk {index}', slug=f'bulk-{index}', normalized_name=f'bulk {index}')
            for index in range(LOOKUP_CAP + 5)
        )

        response = self.client.get(reverse('skill-list'), {'search': 'bulk'})

        self.assertEqual(len(response.data), LOOKUP_CAP)

    def test_group_list_returns_only_active_groups_with_parent(self):
        response = self.client.get(reverse('skill-group-list'))

        self.assertEqual(response.status_code, 200)
        groups = {item['name']: item for item in response.data}
        self.assertNotIn('Zz Ẩn', groups)
        self.assertEqual(
            groups['Zz Backend'],
            {
                'id': self.backend.pk,
                'name': 'Zz Backend',
                'slug': 'zz-backend',
                'parent': self.engineering.pk,
            },
        )
        self.assertIsNone(groups['Zz Kỹ thuật']['parent'])

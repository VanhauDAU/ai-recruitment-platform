"""Query contract for the admin service-category read model.

The category list must stay flat as rows and related packages grow. Increasing
this budget requires an explanation alongside the serializer/query change.
"""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from ..models import ServiceCategory, ServicePackage

ADMIN_SERVICE_CATEGORY_LIST_QUERY_BUDGET = 1
ADMIN_SERVICE_CATEGORY_DETAIL_QUERY_BUDGET = 1


class AdminServiceCategoryQueryBudgetTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='service-budget-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        self.categories = []
        for category_index in range(5):
            category = ServiceCategory.objects.create(
                key=f'budget-category-{category_index}',
                name_vi=f'Nhóm ngân sách {category_index}',
                order=category_index,
            )
            self.categories.append(category)
            for package_index in range(category_index):
                ServicePackage.objects.create(
                    category=category,
                    slug=f'budget-package-{category_index}-{package_index}',
                    name_vi=f'Gói {category_index}-{package_index}',
                    is_active=package_index % 2 == 0,
                )
        self.client.force_authenticate(self.admin)

    def test_category_list_count_is_flat_and_counts_all_packages(self):
        with self.assertNumQueries(ADMIN_SERVICE_CATEGORY_LIST_QUERY_BUDGET):
            response = self.client.get(reverse('services-admin-categories'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        categories_by_key = {item['key']: item for item in response.data}
        for expected_count, category in enumerate(self.categories):
            item = categories_by_key[category.key]
            self.assertEqual(item['packages_count'], expected_count)
            self.assertEqual(
                set(item),
                {
                    'id',
                    'key',
                    'name_vi',
                    'name_en',
                    'description_vi',
                    'description_en',
                    'icon',
                    'order',
                    'is_active',
                    'packages_count',
                },
            )

    def test_category_create_response_keeps_packages_count(self):
        response = self.client.post(
            reverse('services-admin-categories'),
            {
                'key': 'budget-created-category',
                'name_vi': 'Nhóm mới',
                'order': 10,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn('packages_count', response.data)
        self.assertEqual(response.data['packages_count'], 0)

    def test_category_detail_uses_the_same_annotated_count(self):
        category = self.categories[-1]

        with self.assertNumQueries(ADMIN_SERVICE_CATEGORY_DETAIL_QUERY_BUDGET):
            response = self.client.get(
                reverse('services-admin-category-detail', args=[category.pk])
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['packages_count'], 4)

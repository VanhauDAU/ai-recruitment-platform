from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase

from apps.accounts.tests.factories import make_admin
from apps.employers.tests.factories import make_employer
from apps.jobs.models import Benefit, JobCategory, JobCategoryLocalization, Language

Type = JobCategory.CategoryType


def png(width, height):
    from io import BytesIO

    buffer = BytesIO()
    Image.new('RGB', (width, height), 'white').save(buffer, format='PNG')
    return SimpleUploadedFile('icon.png', buffer.getvalue(), content_type='image/png')


class AdminJobCategoryApiTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(make_admin())
        self.group = JobCategory.objects.create(
            name='Công nghệ', category_type=Type.OCCUPATION_GROUP
        )
        self.domain = JobCategory.objects.create(
            name='Phần mềm', parent=self.group, category_type=Type.DOMAIN
        )
        self.list_url = reverse('admin-job-category-list')

    def detail(self, category):
        return reverse('admin-job-category-detail', args=[category.pk])

    def test_only_admins_can_manage_categories(self):
        self.client.force_authenticate(make_employer('employer@example.com'))

        self.assertEqual(self.client.get(self.list_url).status_code, 403)

    def test_level_follows_the_parent(self):
        response = self.client.post(
            self.list_url,
            {'name': 'Lập trình viên Go', 'name_en': 'Go Developer', 'parent': self.domain.pk},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['category_type'], Type.SPECIALIZATION)
        self.assertEqual(response.data['name_en'], 'Go Developer')
        category = JobCategory.objects.get(pk=response.data['id'])
        self.assertEqual(
            dict(category.localizations.values_list('locale', 'display_name')),
            {'vi-VN': 'Lập trình viên Go', 'en-US': 'Go Developer'},
        )

    def test_specialization_needs_an_english_name(self):
        response = self.client.post(
            self.list_url, {'name': 'Lập trình viên Rust', 'parent': self.domain.pk}, format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('name_en', response.data)

    def test_specialization_cannot_have_children(self):
        position = JobCategory.objects.create(
            name='Backend', parent=self.domain, category_type=Type.SPECIALIZATION
        )

        response = self.client.post(
            self.list_url, {'name': 'Con', 'name_en': 'Child', 'parent': position.pk}, format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('parent', response.data)

    def test_moving_to_another_level_is_rejected(self):
        response = self.client.patch(self.detail(self.domain), {'parent': None}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(JobCategory.objects.get(pk=self.domain.pk).parent, self.group)

    def test_rename_keeps_vietnamese_localization_in_sync_and_blank_english_removes_it(self):
        JobCategoryLocalization.objects.create(
            category=self.domain, locale='vi-VN', display_name='Phần mềm'
        )
        JobCategoryLocalization.objects.create(
            category=self.domain, locale='en-US', display_name='Software'
        )

        response = self.client.patch(
            self.detail(self.domain), {'name': 'Phát triển phần mềm', 'name_en': ''}, format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            list(self.domain.localizations.values_list('locale', 'display_name')),
            [('vi-VN', 'Phát triển phần mềm')],
        )

    def test_sibling_names_must_differ(self):
        response = self.client.post(
            self.list_url, {'name': 'phần mềm', 'parent': self.group.pk}, format='json'
        )

        self.assertEqual(response.status_code, 400)

    def test_list_counts_children(self):
        rows = {row['name']: row for row in self.client.get(self.list_url).data}

        self.assertEqual(rows['Công nghệ']['child_count'], 1)
        self.assertEqual(rows['Phần mềm']['job_count'], 0)

    def test_icon_must_be_roughly_square(self):
        url = reverse('admin-job-category-icon')

        wide = self.client.post(url, {'file': png(300, 100)}, format='multipart')
        square = self.client.post(url, {'file': png(128, 128)}, format='multipart')

        self.assertEqual(wide.status_code, 400)
        self.assertEqual(square.status_code, 201)
        self.assertTrue(square.data['path'].startswith('jobs/categories/logos/'))


class AdminBenefitAndLanguageApiTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(make_admin())

    def test_new_benefit_goes_last_and_reorder_needs_every_benefit(self):
        existing = list(Benefit.objects.order_by('sort_order').values_list('pk', flat=True))
        last = max(Benefit.objects.values_list('sort_order', flat=True), default=-1)

        created = self.client.post(
            reverse('admin-benefit-list'),
            {'name': 'Phúc lợi thử', 'category': 'other'},
            format='json',
        )
        partial = self.client.post(
            reverse('admin-benefit-reorder'), {'ids': existing[:1]}, format='json'
        )
        reordered = self.client.post(
            reverse('admin-benefit-reorder'),
            {'ids': [created.data['id'], *existing]},
            format='json',
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['sort_order'], last + 1)
        self.assertEqual(partial.status_code, 400)
        self.assertEqual(reordered.data[0]['name'], 'Phúc lợi thử')

    def test_duplicate_language_name_is_rejected_and_hiding_removes_it_from_the_picker(self):
        language = Language.objects.create(name='Tiếng thử', code='xx')

        duplicate = self.client.post(
            reverse('admin-language-list'), {'name': 'Tiếng thử', 'code': 'yy'}, format='json'
        )
        hidden = self.client.patch(
            reverse('admin-language-detail', args=[language.pk]),
            {'is_active': False},
            format='json',
        )
        picker = self.client.get(reverse('language-list'))

        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(hidden.status_code, 200)
        self.assertEqual(hidden.data['job_count'], 0)
        self.assertNotIn('Tiếng thử', [row['name'] for row in picker.data])

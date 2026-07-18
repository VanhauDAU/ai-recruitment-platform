from importlib import import_module

from django.apps import apps as django_apps
from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.sitecontent.models import LinkGroup, LinkItem

from .models import ConsultationLead, ServiceCategory, ServicePackage

LOCAL_CACHE = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'services-tests',
    }
}

LEAD_PAYLOAD = {
    'full_name': 'Nguyễn Văn A',
    'company_name': 'Công ty TNHH ABC',
    'email': 'a@example.com',
    'phone': '0912345678',
    'province': 'Hà Nội',
    'need': 'post_job',
    'note': 'Cần tư vấn đăng tin.',
    'source_page': '/tuyendung',
}


def make_category(**overrides):
    defaults = {'key': 'featured-jobs', 'name_vi': 'Tin nổi bật', 'order': 1}
    defaults.update(overrides)
    return ServiceCategory.objects.create(**defaults)


def make_package(category, **overrides):
    defaults = {
        'slug': 'top-max', 'name_vi': 'TOP MAX', 'price': 7500000,
        'benefits_vi': ['Quyền lợi 1'], 'order': 1,
    }
    defaults.update(overrides)
    return ServicePackage.objects.create(category=category, **defaults)


@override_settings(CACHES=LOCAL_CACHE)
class PublicPackagesApiTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_returns_only_active_grouped_by_category(self):
        category = make_category()
        make_package(category)
        make_package(category, slug='inactive-pack', is_active=False)
        inactive_category = make_category(key='hidden', name_vi='Ẩn', is_active=False, order=2)
        make_package(inactive_category, slug='pack-in-hidden')

        response = self.client.get(reverse('services-packages'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([c['key'] for c in response.data], ['featured-jobs'])
        packages = response.data[0]['packages']
        self.assertEqual([p['slug'] for p in packages], ['top-max'])
        self.assertEqual(packages[0]['benefits_vi'], ['Quyền lợi 1'])

    def test_cache_invalidated_when_package_changes(self):
        category = make_category()
        make_package(category)
        first = self.client.get(reverse('services-packages'))
        self.assertEqual(len(first.data[0]['packages']), 1)

        make_package(category, slug='top-eco', name_vi='TOP ECO', order=2)

        second = self.client.get(reverse('services-packages'))
        self.assertEqual(len(second.data[0]['packages']), 2)


@override_settings(CACHES=LOCAL_CACHE)
class ConsultationLeadApiTests(APITestCase):
    def setUp(self):
        # Throttle history nằm trong cache — xoá để các test không giẫm quota nhau.
        cache.clear()

    def test_guest_can_create_lead(self):
        response = self.client.post(reverse('services-consultations'), LEAD_PAYLOAD)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        lead = ConsultationLead.objects.get()
        self.assertEqual(lead.full_name, LEAD_PAYLOAD['full_name'])
        self.assertEqual(lead.status, ConsultationLead.Status.NEW)
        self.assertEqual(lead.source_page, '/tuyendung')

    def test_requires_contact_fields(self):
        response = self.client.post(reverse('services-consultations'), {'note': 'thiếu thông tin'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        for field in ('full_name', 'email', 'phone'):
            self.assertIn(field, response.data)

    def test_rejects_invalid_phone(self):
        response = self.client.post(reverse('services-consultations'), {**LEAD_PAYLOAD, 'phone': 'abc'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', response.data)

    def test_throttled_after_five_requests_per_minute(self):
        for _ in range(5):
            response = self.client.post(reverse('services-consultations'), LEAD_PAYLOAD)
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.post(reverse('services-consultations'), LEAD_PAYLOAD)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


@override_settings(CACHES=LOCAL_CACHE)
class AdminServicesApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@example.com', password='Password@123', role=User.Role.ADMIN,
        )
        self.candidate = User.objects.create_user(
            email='candidate@example.com', password='Password@123', role=User.Role.CANDIDATE,
        )
        self.category = make_category()
        self.package = make_package(self.category)

    def test_requires_admin_role(self):
        list_url = reverse('services-admin-packages')
        self.assertEqual(self.client.get(list_url).status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(self.candidate)
        self.assertEqual(self.client.get(list_url).status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_crud_package(self):
        self.client.force_authenticate(self.admin)

        created = self.client.post(reverse('services-admin-packages'), {
            'category': self.category.pk, 'slug': 'top-eco', 'name_vi': 'TOP ECO',
            'price': 4400000, 'benefits_vi': ['Ưu tiên hiển thị'], 'order': 2,
        }, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        listed = self.client.get(reverse('services-admin-packages'))
        self.assertEqual({p['slug'] for p in listed.data}, {'top-max', 'top-eco'})

        detail_url = reverse('services-admin-package-detail', args=[created.data['id']])
        patched = self.client.patch(detail_url, {'price': 4000000, 'is_active': False}, format='json')
        self.assertEqual(patched.status_code, status.HTTP_200_OK)
        self.assertEqual(patched.data['price'], '4000000')

        self.assertEqual(self.client.delete(detail_url).status_code, status.HTTP_204_NO_CONTENT)

    def test_package_rejects_invalid_benefits(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('services-admin-packages'), {
            'category': self.category.pk, 'slug': 'bad', 'name_vi': 'Bad',
            'benefits_vi': 'không phải list',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('benefits_vi', response.data)

    def test_cannot_delete_category_with_packages(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(reverse('services-admin-category-detail', args=[self.category.pk]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(ServiceCategory.objects.filter(pk=self.category.pk).exists())

    def test_admin_can_mark_lead_contacted(self):
        lead = ConsultationLead.objects.create(
            full_name='Trần B', email='b@example.com', phone='0987654321',
        )
        self.client.force_authenticate(self.admin)

        listed = self.client.get(reverse('services-admin-consultations'), {'status': 'new'})
        self.assertEqual(listed.data['count'], 1)

        response = self.client.patch(
            reverse('services-admin-consultation-detail', args=[lead.pk]),
            {'status': 'contacted'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertEqual(lead.status, ConsultationLead.Status.CONTACTED)


@override_settings(CACHES=LOCAL_CACHE)
class SeedServicesTests(APITestCase):
    def test_seed_is_idempotent_and_keeps_admin_edits(self):
        call_command('seed_services', verbosity=0)
        categories = ServiceCategory.objects.count()
        packages = ServicePackage.objects.count()
        self.assertGreater(categories, 0)
        self.assertGreater(packages, 0)

        top_max = ServicePackage.objects.get(slug='top-max')
        top_max.price = 9999999
        top_max.save()

        call_command('seed_services', verbosity=0)
        self.assertEqual(ServiceCategory.objects.count(), categories)
        self.assertEqual(ServicePackage.objects.count(), packages)
        top_max.refresh_from_db()
        self.assertEqual(int(top_max.price), 9999999)


class EmployerFooterLinkFixTests(APITestCase):
    def test_migrated_database_has_no_stale_employer_urls(self):
        # Migration 0006 seed group với prefix cũ /nha-tuyen-dung; 0015 phải sửa
        # hết khi dựng DB — còn sót là footer link 404.
        urls = list(LinkItem.objects.filter(group__key='footer-employer').values_list('url', flat=True))
        self.assertTrue(urls)
        self.assertFalse([u for u in urls if u.startswith('/nha-tuyen-dung')])
        self.assertIn('/tuyendung/bao-gia', urls)

    def test_fix_function_updates_stale_rows(self):
        migration = import_module('apps.sitecontent.migrations.0015_fix_employer_footer_links')
        group = LinkGroup.objects.get(key='footer-employer')
        stale = LinkItem.objects.create(group=group, label='Link cũ', url='/nha-tuyen-dung/dich-vu', order=99)

        migration.fix_employer_footer_links(django_apps, None)

        stale.refresh_from_db()
        self.assertEqual(stale.url, '/tuyendung/dich-vu')

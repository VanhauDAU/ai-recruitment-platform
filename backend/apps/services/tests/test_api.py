import csv
import json
from datetime import UTC, datetime
from importlib import import_module
from io import StringIO
from unittest.mock import patch

from django.apps import apps as django_apps
from django.core.cache import cache
from django.core.management import call_command
from django.db import transaction
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import (
    AdminAccessAuditLog,
    AdminPermission,
    AdminRole,
    Department,
    User,
)
from apps.accounts.services import assign_membership
from apps.sitecontent.models import LinkGroup, LinkItem

from ..models import (
    ConsultationLead,
    ServiceCapability,
    ServiceCategory,
    ServicePackage,
)
from ..services import (
    add_package_version_item,
    create_package_version,
    publish_package_version,
)
from ..signals import PUBLIC_PACKAGES_CACHE_KEY

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
        'slug': 'top-max',
        'name_vi': 'TOP MAX',
        'price': 7500000,
        'benefits_vi': ['Quyền lợi 1'],
        'order': 1,
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
        self.assertIsNone(packages[0]['published_version'])

    @override_settings(SERVICE_CATALOG_V2_ENABLED=True)
    def test_includes_the_structured_published_version_without_breaking_legacy_fields(self):
        category = make_category()
        package = make_package(category)
        version = create_package_version(package=package, price=299000)
        add_package_version_item(
            package_version=version,
            capability=ServiceCapability.objects.get(code='sponsored_placement'),
            duration_days=14,
            configuration={'placement': 'search_sponsored'},
        )
        draft_response = self.client.get(reverse('services-packages'))
        self.assertEqual(draft_response.data, [])

        with self.captureOnCommitCallbacks(execute=True):
            publish_package_version(package_version=version)

        response = self.client.get(reverse('services-packages'))

        package_data = response.data[0]['packages'][0]
        self.assertEqual(package_data['slug'], 'top-max')
        self.assertEqual(package_data['published_version']['price'], '299000')
        self.assertEqual(package_data['published_version']['activate_within_days'], 90)
        self.assertEqual(
            package_data['published_version']['items'][0],
            {
                'capability': 'sponsored_placement',
                'name_vi': 'Vị trí tài trợ',
                'name_en': '',
                'quantity': 1,
                'duration_days': 14,
                'configuration': {'placement': 'search_sponsored'},
            },
        )

    def test_cache_invalidated_when_package_changes(self):
        category = make_category()
        make_package(category)
        first = self.client.get(reverse('services-packages'))
        self.assertEqual(len(first.data[0]['packages']), 1)

        with self.captureOnCommitCallbacks(execute=True):
            make_package(category, slug='top-eco', name_vi='TOP ECO', order=2)

        second = self.client.get(reverse('services-packages'))
        self.assertEqual(len(second.data[0]['packages']), 2)

    def test_cache_invalidation_waits_for_the_database_commit(self):
        category = make_category()
        cache.set(PUBLIC_PACKAGES_CACHE_KEY, [{'key': 'still-valid'}], 60)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            make_package(category)
            self.assertEqual(cache.get(PUBLIC_PACKAGES_CACHE_KEY), [{'key': 'still-valid'}])

        self.assertEqual(len(callbacks), 1)
        callbacks[0]()
        self.assertIsNone(cache.get(PUBLIC_PACKAGES_CACHE_KEY))

    def test_rolled_back_package_change_keeps_the_committed_cache(self):
        category = make_category()
        cache.set(PUBLIC_PACKAGES_CACHE_KEY, [{'key': 'committed'}], 60)

        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    make_package(category)
                    raise RuntimeError('rollback')

        self.assertEqual(callbacks, [])
        self.assertEqual(cache.get(PUBLIC_PACKAGES_CACHE_KEY), [{'key': 'committed'}])


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
        response = self.client.post(
            reverse('services-consultations'), {**LEAD_PAYLOAD, 'phone': 'abc'}
        )

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
            email='admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        department = Department.objects.create(
            code='employer-services',
            name='Dịch vụ nhà tuyển dụng',
        )
        role = AdminRole.objects.create(
            department=department,
            code='manager',
            name='Trưởng phòng',
        )
        permissions = []
        for code in (
            'service_catalog.view',
            'service_catalog.manage',
            'consultation_lead.view',
            'consultation_lead.export',
            'consultation_lead.manage',
        ):
            permission, _ = AdminPermission.objects.get_or_create(
                code=code,
                defaults={
                    'module': code.split('.')[0],
                    'label': code,
                },
            )
            permissions.append(permission)
        role.permissions.add(*permissions)
        self.role = role
        assign_membership(self.admin, role, actor=self.admin)
        self.candidate = User.objects.create_user(
            email='candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
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

        created = self.client.post(
            reverse('services-admin-packages'),
            {
                'category': self.category.pk,
                'slug': 'top-eco',
                'name_vi': 'TOP ECO',
                'price': 4400000,
                'benefits_vi': ['Ưu tiên hiển thị'],
                'order': 2,
            },
            format='json',
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        listed = self.client.get(reverse('services-admin-packages'))
        self.assertEqual({p['slug'] for p in listed.data}, {'top-max', 'top-eco'})

        detail_url = reverse('services-admin-package-detail', args=[created.data['id']])
        patched = self.client.patch(
            detail_url, {'price': 4000000, 'is_active': False}, format='json'
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK)
        self.assertEqual(patched.data['price'], '4000000')

        self.assertEqual(self.client.delete(detail_url).status_code, status.HTTP_204_NO_CONTENT)

    def test_package_rejects_invalid_benefits(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse('services-admin-packages'),
            {
                'category': self.category.pk,
                'slug': 'bad',
                'name_vi': 'Bad',
                'benefits_vi': 'không phải list',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('benefits_vi', response.data)

    def test_cannot_delete_category_with_packages(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(
            reverse('services-admin-category-detail', args=[self.category.pk])
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(ServiceCategory.objects.filter(pk=self.category.pk).exists())

    def test_admin_can_mark_lead_contacted(self):
        lead = ConsultationLead.objects.create(
            full_name='Trần B',
            email='b@example.com',
            phone='0987654321',
        )
        self.client.force_authenticate(self.admin)

        listed = self.client.get(reverse('services-admin-consultations'), {'status': 'new'})
        self.assertEqual(listed.data['count'], 1)

        response = self.client.patch(
            reverse('services-admin-consultation-detail', args=[lead.pk]),
            {'status': 'contacted'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertEqual(lead.status, ConsultationLead.Status.CONTACTED)

    def test_admin_lead_list_applies_validated_search_date_and_ordering_filters(self):
        target = ConsultationLead.objects.create(
            full_name='Alpha Contact',
            company_name='Alpha Co',
            email='alpha@example.com',
            phone='0901000001',
            status=ConsultationLead.Status.NEW,
        )
        target_later = ConsultationLead.objects.create(
            full_name='Alpha Zeta',
            email='zeta@example.com',
            phone='0901000004',
            status=ConsultationLead.Status.NEW,
        )
        old = ConsultationLead.objects.create(
            full_name='Alpha cũ',
            email='old-alpha@example.com',
            phone='0901000002',
            status=ConsultationLead.Status.NEW,
        )
        ConsultationLead.objects.create(
            full_name='Alpha đã liên hệ',
            email='contacted-alpha@example.com',
            phone='0901000003',
            status=ConsultationLead.Status.CONTACTED,
        )
        ConsultationLead.objects.filter(pk=target.pk).update(
            created_at=datetime(2026, 8, 5, 8, tzinfo=UTC)
        )
        ConsultationLead.objects.filter(pk=target_later.pk).update(
            created_at=datetime(2026, 8, 5, 9, tzinfo=UTC)
        )
        ConsultationLead.objects.filter(pk=old.pk).update(
            created_at=datetime(2026, 8, 1, 8, tzinfo=UTC)
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(
            reverse('services-admin-consultations'),
            {
                'status': 'new',
                'q': 'alpha',
                'created_from': '2026-08-05',
                'created_to': '2026-08-05',
                'ordering': 'email',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(
            [item['id'] for item in response.data['results']],
            [target.pk, target_later.pk],
        )

        descending = self.client.get(
            reverse('services-admin-consultations'),
            {
                'status': 'new',
                'q': 'alpha',
                'created_from': '2026-08-05',
                'created_to': '2026-08-05',
                'ordering': '-email',
            },
        )
        self.assertEqual(descending.status_code, status.HTTP_200_OK, descending.data)
        self.assertEqual(
            [item['id'] for item in descending.data['results']],
            [target_later.pk, target.pk],
        )

        invalid_ordering = self.client.get(
            reverse('services-admin-consultations'),
            {'ordering': 'private_field'},
        )
        reversed_dates = self.client.get(
            reverse('services-admin-consultations'),
            {'created_from': '2026-08-06', 'created_to': '2026-08-05'},
        )
        invalid_status = self.client.get(
            reverse('services-admin-consultations'),
            {'status': 'unknown'},
        )
        self.assertEqual(invalid_ordering.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(reversed_dates.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_status.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_export_is_utf8_formula_safe_filtered_and_audited_without_search_value(self):
        lead = ConsultationLead.objects.create(
            full_name='=Formula Contact',
            company_name='+Danger Inc',
            email='formula@example.com',
            phone='-0912345678',
            province='@Hà Nội',
            need=ConsultationLead.Need.BUY_SERVICE,
            note='\tGhi chú nguy hiểm',
            source_page='\r/tuyendung',
            status=ConsultationLead.Status.NEW,
        )
        ConsultationLead.objects.create(
            full_name='Không khớp',
            email='other@example.com',
            phone='0900000000',
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(
            reverse('services-admin-consultations-export'),
            {'status': 'new', 'q': 'Formula', 'ordering': 'full_name'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv; charset=utf-8')
        self.assertIn('attachment; filename="consultation-leads-', response['Content-Disposition'])
        self.assertTrue(response.content.startswith(b'\xef\xbb\xbf'))
        rows = list(csv.reader(StringIO(response.content.decode('utf-8-sig'))))
        self.assertEqual(
            rows[0],
            [
                'ID',
                'Khách hàng',
                'Công ty',
                'Email',
                'Số điện thoại',
                'Tỉnh/TP',
                'Nhu cầu',
                'Ghi chú',
                'Nguồn',
                'Trạng thái',
                'Ngày gửi',
            ],
        )
        self.assertEqual(len(rows), 2)
        exported = rows[1]
        self.assertEqual(exported[0], str(lead.pk))
        for index in (1, 2, 4, 5, 7, 8):
            self.assertTrue(exported[index].startswith("'"), exported[index])

        audit = AdminAccessAuditLog.objects.get(action='export_consultation_leads')
        self.assertEqual(audit.target_type, 'consultation_lead_export')
        self.assertEqual(audit.payload['filter_names'], ['status', 'q'])
        self.assertEqual(audit.payload['row_count'], 1)
        serialized_payload = json.dumps(audit.payload, ensure_ascii=False)
        for forbidden in ('Formula', lead.email, lead.phone):
            self.assertNotIn(forbidden, serialized_payload)

    def test_admin_export_requires_dedicated_permission(self):
        viewer = User.objects.create_user(
            email='lead-viewer@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        viewer_role = AdminRole.objects.create(
            department=self.role.department,
            code='viewer',
            name='Người xem',
        )
        viewer_role.permissions.add(AdminPermission.objects.get(code='consultation_lead.view'))
        assign_membership(viewer, viewer_role, actor=self.admin)
        self.client.force_authenticate(viewer)

        listed = self.client.get(reverse('services-admin-consultations'))
        exported = self.client.get(reverse('services-admin-consultations-export'))

        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(exported.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            AdminAccessAuditLog.objects.filter(
                actor=viewer,
                action='export_consultation_leads',
            ).exists()
        )

        exporter = User.objects.create_user(
            email='lead-exporter@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        exporter_role = AdminRole.objects.create(
            department=self.role.department,
            code='exporter',
            name='Người xuất thiếu quyền xem',
        )
        exporter_role.permissions.add(AdminPermission.objects.get(code='consultation_lead.export'))
        assign_membership(exporter, exporter_role, actor=self.admin)
        self.client.force_authenticate(exporter)

        export_without_view = self.client.get(reverse('services-admin-consultations-export'))

        self.assertEqual(export_without_view.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            AdminAccessAuditLog.objects.filter(
                actor=exporter,
                action='export_consultation_leads',
            ).exists()
        )

    @patch('apps.services.api.views.catalog.ADMIN_CONSULTATION_LEAD_EXPORT_LIMIT', 2)
    def test_admin_export_reports_when_the_safety_limit_truncates_rows(self):
        for index in range(3):
            ConsultationLead.objects.create(
                full_name=f'Lead {index}',
                email=f'lead-{index}@example.com',
                phone=f'090000000{index}',
            )
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse('services-admin-consultations-export'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['X-Export-Row-Limit'], '2')
        self.assertEqual(response['X-Export-Truncated'], 'true')
        rows = list(csv.reader(StringIO(response.content.decode('utf-8-sig'))))
        self.assertEqual(len(rows), 3)


@override_settings(CACHES=LOCAL_CACHE)
class SeedServicesTests(APITestCase):
    def test_seed_is_idempotent_and_keeps_admin_edits(self):
        call_command('seed_services', verbosity=0)
        categories = ServiceCategory.objects.count()
        packages = ServicePackage.objects.count()
        self.assertGreater(categories, 0)
        self.assertGreater(packages, 0)

        priority = ServicePackage.objects.get(slug='priority-14-days')
        priority.price = 9999999
        priority.save()

        call_command('seed_services', verbosity=0)
        self.assertEqual(ServiceCategory.objects.count(), categories)
        self.assertEqual(ServicePackage.objects.count(), packages)
        priority.refresh_from_db()
        self.assertEqual(int(priority.price), 9999999)
        self.assertFalse(ServicePackage.objects.filter(slug='top-max').exists())


class EmployerFooterLinkFixTests(APITestCase):
    def test_migrated_database_has_no_stale_employer_urls(self):
        # Migration 0006 seed group với prefix cũ /nha-tuyen-dung; 0015 phải sửa
        # hết khi dựng DB — còn sót là footer link 404.
        urls = list(
            LinkItem.objects.filter(group__key='footer-employer').values_list('url', flat=True)
        )
        self.assertTrue(urls)
        self.assertFalse([u for u in urls if u.startswith('/nha-tuyen-dung')])
        self.assertIn('/tuyendung/bao-gia', urls)

    def test_fix_function_updates_stale_rows(self):
        migration = import_module('apps.sitecontent.migrations.0015_fix_employer_footer_links')
        group = LinkGroup.objects.get(key='footer-employer')
        stale = LinkItem.objects.create(
            group=group, label='Link cũ', url='/nha-tuyen-dung/dich-vu', order=99
        )

        migration.fix_employer_footer_links(django_apps, None)

        stale.refresh_from_db()
        self.assertEqual(stale.url, '/tuyendung/dich-vu')

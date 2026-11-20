from datetime import timedelta
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import AdminAccessAuditLog, User
from apps.employers.tests.factories import (
    add_recruiter,
    hold_company,
    make_company,
    make_employer,
    publish_job,
)

from ..models import Banner


def _image(width, height, fmt='PNG'):
    buffer = BytesIO()
    Image.new('RGB', (width, height), (16, 185, 129)).save(buffer, format=fmt)
    return SimpleUploadedFile(f'banner.{fmt.lower()}', buffer.getvalue(), f'image/{fmt.lower()}')


class PublicBannerApiTests(APITestCase):
    url = reverse('site-banners')

    def setUp(self):
        self.owner = make_employer('banner-owner@example.com')
        self.company = make_company(self.owner, name='Ngân hàng Ánh Dương', slug='anh-duong')

    def banner(self, **values):
        return Banner.objects.create(
            placement=Banner.Placement.HOME_HERO, title=values.pop('title', 'Slide'), **values
        )

    def titles(self):
        response = self.client.get(self.url, {'placement': 'home_hero'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return [item['title'] for item in response.data]

    def test_only_running_banners_within_schedule_are_public(self):
        now = timezone.now()
        self.banner(title='Đang chạy', order=1)
        self.banner(title='Chưa tới giờ', starts_at=now + timedelta(days=1))
        self.banner(title='Hết hạn', ends_at=now - timedelta(minutes=1))
        self.banner(title='Đã tắt', is_active=False)
        self.banner(
            title='Trong khung giờ',
            starts_at=now - timedelta(days=1),
            ends_at=now + timedelta(days=1),
            order=2,
        )

        self.assertEqual(self.titles(), ['Đang chạy', 'Trong khung giờ'])

    def test_company_slide_carries_public_company_and_open_job_count(self):
        recruiter = add_recruiter(self.company)
        publish_job(self.company, recruiter)
        publish_job(self.company, recruiter)
        self.banner(title='', kind=Banner.Kind.COMPANY, company=self.company)

        [item] = self.client.get(self.url, {'placement': 'home_hero'}).data

        self.assertEqual(item['kind'], 'company')
        self.assertEqual(item['company']['slug'], 'anh-duong')
        self.assertEqual(item['company']['active_public_job_count'], 2)

    def test_company_slide_hidden_when_company_on_hold_or_removed(self):
        self.banner(title='Có công ty', kind=Banner.Kind.COMPANY, company=self.company)
        self.banner(title='Mất công ty', kind=Banner.Kind.COMPANY)
        hold_company(self.company)

        self.assertEqual(self.titles(), [])

    def test_public_list_query_count_is_flat(self):
        other = make_company(self.owner, name='Công ty Hai', slug='cong-ty-hai')
        self.banner(title='A', kind=Banner.Kind.COMPANY, company=self.company)
        # banner list + company join, industries prefetch, job counts, maintenance switch.
        with self.assertNumQueries(4):
            self.client.get(self.url, {'placement': 'home_hero'})
        self.banner(title='B', kind=Banner.Kind.COMPANY, company=other)
        self.banner(title='C')
        with self.assertNumQueries(4):
            self.client.get(self.url, {'placement': 'home_hero'})


class AdminBannerApiTests(APITestCase):
    list_url = reverse('site-admin-banners')

    def setUp(self):
        self.admin = User.objects.create_user(
            email='banner-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(self.admin)
        self.company = make_company(make_employer('banner-hr@example.com'), name='Eximland')

    def upload(self, image, kind='image', placement='home_hero'):
        return self.client.post(
            reverse('site-admin-banner-images'),
            {'file': image, 'kind': kind, 'placement': placement},
            format='multipart',
        )

    def create(self, **payload):
        body = {'placement': 'home_hero', 'kind': 'promo', 'title': 'Slide', **payload}
        return self.client.post(self.list_url, body, format='json')

    def test_create_image_slide_after_upload_and_audit(self):
        uploaded = self.upload(_image(1600, 600))
        self.assertEqual(uploaded.status_code, status.HTTP_201_CREATED, uploaded.data)

        created = self.create(
            kind='image',
            title='Banner Eximland',
            image_url=uploaded.data['path'],
            company=self.company.public_id,
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(created.data['image_path'], uploaded.data['path'])
        self.assertEqual(created.data['company']['public_id'], self.company.public_id)
        self.assertEqual(created.data['schedule_state'], 'running')
        self.assertTrue(
            AdminAccessAuditLog.objects.filter(
                action='banner.create', target_public_id=str(created.data['id'])
            ).exists()
        )

    def test_kind_rules_are_enforced(self):
        self.assertIn('company', self.create(kind='company', title='').data)
        self.assertIn('image_url', self.create(kind='image', cta_url='/viec-lam').data)
        self.assertIn('title', self.create(title='  ').data)
        self.assertIn('cta_url', self.create(cta_url='javascript:alert(1)').data)
        self.assertIn('image_url', self.create(image_url='https://cdn.example.com/x.png').data)
        now = timezone.now()
        self.assertIn(
            'ends_at',
            self.create(
                starts_at=now.isoformat(), ends_at=(now - timedelta(hours=1)).isoformat()
            ).data,
        )

    def test_hero_image_upload_requires_banner_ratio(self):
        self.assertEqual(self.upload(_image(1600, 1200)).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.upload(_image(800, 300)).status_code, status.HTTP_400_BAD_REQUEST)
        # Ảnh minh họa của slide chữ không bị ràng buộc tỉ lệ 8:3.
        self.assertEqual(
            self.upload(_image(800, 600), kind='promo').status_code, status.HTTP_201_CREATED
        )

    def test_update_reorder_and_delete(self):
        first = self.create(title='Một').data
        second = self.create(title='Hai', is_active=False).data
        self.assertEqual([first['order'], second['order']], [0, 1])
        self.assertEqual(second['schedule_state'], 'off')

        detail = reverse('site-admin-banner-detail', args=[second['id']])
        patched = self.client.patch(detail, {'is_active': True, 'title': 'Hai mới'}, format='json')
        self.assertEqual(patched.data['title'], 'Hai mới')
        self.assertEqual(patched.data['schedule_state'], 'running')

        reorder = reverse('site-admin-banner-reorder')
        bad = self.client.post(
            reorder, {'placement': 'home_hero', 'ids': [second['id']]}, format='json'
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.client.post(
            reorder, {'placement': 'home_hero', 'ids': [second['id'], first['id']]}, format='json'
        )
        listed = self.client.get(self.list_url, {'placement': 'home_hero'}).data
        self.assertEqual([item['title'] for item in listed], ['Hai mới', 'Một'])

        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Banner.objects.filter(pk=second['id']).exists())

    def test_non_admin_is_rejected(self):
        self.client.force_authenticate(make_employer('banner-intruder@example.com'))
        self.assertEqual(self.client.get(self.list_url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.create().status_code, status.HTTP_403_FORBIDDEN)

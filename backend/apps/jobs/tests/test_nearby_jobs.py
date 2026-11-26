"""Việc làm gần bạn (ADR-0029): matching, ordering, the map and address lookup."""

from datetime import timedelta
from unittest import mock

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.locations.models import Location
from apps.locations.services import PlaceSuggestion
from apps.sitecontent.models import SiteSetting

from ..models import Job, JobLocation
from .factories import open_visibility_window

# Hoàn Kiếm (origin) → Ba Đình ≈ 1,6 km → Cầu Giấy ≈ 6 km → Long Biên ≈ 4 km;
# Sóc Sơn ≈ 33 km; Bến Thành (HCMC) ≈ 1.140 km.
ORIGIN = {'lat': 21.0285, 'lng': 105.8542}
Precision = JobLocation.Precision


def set_setting(key, value, value_type=SiteSetting.ValueType.NUMBER):
    SiteSetting.objects.update_or_create(
        key=key,
        defaults={'label': key, 'group': 'jobs', 'value': value, 'value_type': value_type},
    )


class NearbyFixture:
    def setUp(self):
        super().setUp()
        self.employer = User.objects.create_user(
            email='nearby@example.com', password='Password@123', role=User.Role.EMPLOYER
        )
        self.company = Company.objects.create(company_name='Gần Co', created_by=self.employer)
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
        self.hanoi = self.place('n-hn', 'Thành phố Hà Nội', None, 21.0, 105.7)
        self.hcm = self.place('n-hcm', 'Thành phố Hồ Chí Minh', None, 10.8, 106.7)
        self.hoan_kiem = self.place('n-hk', 'Phường Hoàn Kiếm', self.hanoi, 21.0320, 105.8504)
        self.ba_dinh = self.place('n-bd', 'Phường Ba Đình', self.hanoi, 21.0385, 105.8381)
        self.cau_giay = self.place('n-cg', 'Phường Cầu Giấy', self.hanoi, 21.0330, 105.7930)
        self.long_bien = self.place('n-lb', 'Phường Long Biên', self.hanoi, 21.0450, 105.8880)
        self.soc_son = self.place('n-ss', 'Xã Sóc Sơn', self.hanoi, 21.2580, 105.8480)
        self.ben_thanh = self.place('n-bt', 'Phường Bến Thành', self.hcm, 10.7713, 106.6937)

    def place(self, code, name, parent, lat, lng):
        return Location.objects.create(
            code=code,
            name=name,
            level=Location.Level.WARD if parent else Location.Level.PROVINCE,
            parent=parent,
            latitude=lat,
            longitude=lng,
        )

    def job(self, title, *places, work_types=None, **overrides):
        job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title=title,
            description='Mô tả',
            work_types=work_types or [Job.WorkType.ONSITE],
            work_type=(work_types or [Job.WorkType.ONSITE])[0],
            deadline=timezone.localdate() + timedelta(days=30),
            **{'status': Job.Status.ACTIVE, **open_visibility_window(), **overrides},
        )
        for order, location in enumerate(places):
            is_ward = location.parent_id is not None
            JobLocation.objects.create(
                job=job,
                location=location,
                sort_order=order,
                address_detail=f'Số {order + 1}',
                latitude=location.latitude if is_ward else None,
                longitude=location.longitude if is_ward else None,
                coordinate_precision=Precision.WARD if is_ward else Precision.PROVINCE,
            )
        return job

    def nearby(self, **params):
        response = self.client.get(reverse('job-nearby-list'), {**ORIGIN, **params})
        self.assertEqual(response.status_code, 200, response.data)
        return response.data


class NearbyJobListTests(NearbyFixture, APITestCase):
    def test_jobs_are_ordered_by_their_nearest_workplace(self):
        self.job('Cầu Giấy', self.cau_giay)
        self.job('Ba Đình', self.ba_dinh)
        # Many workplaces: the nearest one (Hoàn Kiếm) decides; HCMC is ignored.
        self.job('Chuỗi cửa hàng', self.ben_thanh, self.long_bien, self.hoan_kiem)
        self.job('Sóc Sơn', self.soc_son)  # outside 10 km

        data = self.nearby()

        titles = [item['title'] for item in data['results']]
        self.assertEqual(titles, ['Chuỗi cửa hàng', 'Ba Đình', 'Cầu Giấy'])
        chain = data['results'][0]
        self.assertLess(chain['distance_km'], 0.6)
        self.assertEqual(chain['match_kind'], 'distance')
        self.assertEqual(chain['nearby_workplace_count'], 2)  # Hoàn Kiếm + Long Biên
        self.assertEqual(
            chain['nearest_workplace']['display'], 'Số 3, Phường Hoàn Kiếm, Thành phố Hà Nội'
        )
        self.assertEqual(data['origin']['ward']['name'], 'Phường Hoàn Kiếm')
        self.assertEqual(data['origin']['radius_km'], 10)
        self.assertIsNone(data['expand_suggestion'])

    def test_radius_is_clamped_to_the_configured_maximum(self):
        self.job('Sóc Sơn', self.soc_son)
        set_setting('nearby_jobs_max_radius_km', 20)
        data = self.nearby(radius_km=500)
        self.assertEqual(data['origin']['radius_km'], 20)
        self.assertEqual(data['count'], 0)

    def test_empty_result_suggests_the_next_radius_with_jobs(self):
        self.job('Sóc Sơn', self.soc_son)
        data = self.nearby(radius_km=5)
        self.assertEqual(data['expand_suggestion'], {'radius_km': 50, 'count': 1})

    def test_province_wide_jobs_follow_the_distance_matches(self):
        self.job('Toàn Hà Nội', self.hanoi)
        self.job('Toàn TP.HCM', self.hcm)
        self.job('Ba Đình', self.ba_dinh)

        data = self.nearby()

        self.assertEqual(
            [(i['title'], i['match_kind'], i['distance_km']) for i in data['results']],
            [('Ba Đình', 'distance', mock.ANY), ('Toàn Hà Nội', 'province_wide', None)],
        )
        self.assertEqual(self.nearby(include_province_wide=0)['count'], 1)

    def test_remote_only_jobs_are_opt_in_and_hybrid_counts_as_onsite(self):
        self.job('Remote', self.hoan_kiem, work_types=[Job.WorkType.REMOTE])
        self.job('Hybrid', self.ba_dinh, work_types=[Job.WorkType.HYBRID, Job.WorkType.REMOTE])
        self.job('Remote không văn phòng', work_types=[Job.WorkType.REMOTE])

        self.assertEqual([i['title'] for i in self.nearby()['results']], ['Hybrid'])
        results = self.nearby(include_remote=1)['results']
        self.assertEqual(results[0]['title'], 'Remote')  # has a nearby office: distance first
        self.assertEqual(
            {(i['title'], i['match_kind']) for i in results[1:]},
            {('Hybrid', 'distance'), ('Remote không văn phòng', 'remote')},
        )

    def test_unavailable_jobs_and_unmapped_rows_never_match(self):
        self.job('Đã đóng', self.hoan_kiem, status=Job.Status.CLOSED)
        legacy = self.job('Chưa có tọa độ')
        JobLocation.objects.create(job=legacy, location=self.hoan_kiem)  # not backfilled yet
        self.assertEqual(self.nearby()['count'], 0)

    def test_existing_list_filters_and_orderings_still_apply(self):
        self.job('Kế toán', self.cau_giay, salary_min=20_000_000, salary_max=30_000_000)
        self.job('Lập trình viên', self.ba_dinh, salary_min=10_000_000, salary_max=15_000_000)
        self.assertEqual(
            [i['title'] for i in self.nearby(search='ke toan')['results']], ['Kế toán']
        )
        self.assertEqual(
            [i['title'] for i in self.nearby(ordering='salary_desc')['results']],
            ['Kế toán', 'Lập trình viên'],
        )

    def test_invalid_origin_or_disabled_feature_is_rejected(self):
        url = reverse('job-nearby-list')
        self.assertEqual(self.client.get(url, {'lat': 'x', 'lng': 105}).status_code, 400)
        self.assertEqual(self.client.get(url, {'lat': 13.75, 'lng': 100.5}).status_code, 400)
        self.assertEqual(self.client.get(url, {**ORIGIN, 'ordering': 'x'}).status_code, 400)
        set_setting('nearby_jobs_enabled', False, SiteSetting.ValueType.BOOLEAN)
        self.assertEqual(self.client.get(url, ORIGIN).status_code, 404)

    def test_pages_allow_geolocation_on_the_same_origin(self):
        response = self.client.get(reverse('job-nearby-list'), ORIGIN)
        self.assertIn('geolocation=(self)', response['Permissions-Policy'])


class NearbyJobMapTests(NearbyFixture, APITestCase):
    def test_points_group_jobs_at_the_same_place_nearest_first(self):
        self.job('A', self.ba_dinh)
        self.job('B', self.ba_dinh)
        self.job('C', self.hoan_kiem, self.cau_giay)
        self.job('Xa', self.ben_thanh)

        response = self.client.get(reverse('job-nearby-map'), ORIGIN)

        self.assertEqual(response.status_code, 200)
        points = response.data['points']
        self.assertEqual(
            [[job['title'] for job in point['jobs']] for point in points],
            [['C'], ['A', 'B'], ['C']],
        )
        self.assertEqual(points[1]['precision'], Precision.WARD)
        self.assertEqual(
            points[1]['jobs'][0]['workplace'], 'Số 1, Phường Ba Đình, Thành phố Hà Nội'
        )
        self.assertFalse(response.data['truncated'])

    def test_marker_cap_reports_truncation(self):
        self.job('A', self.ba_dinh)
        self.job('B', self.cau_giay)
        set_setting('nearby_jobs_max_markers', 1)
        response = self.client.get(reverse('job-nearby-map'), ORIGIN)
        self.assertEqual(len(response.data['points']), 1)
        self.assertTrue(response.data['truncated'])


class GeoLookupApiTests(NearbyFixture, APITestCase):
    def test_autocomplete_lists_local_wards_before_provider_places(self):
        suggestion = PlaceSuggestion('geoapify:21.024,105.853', '1 Tràng Tiền', 'Hoàn Kiếm, Hà Nội')
        with mock.patch(
            'apps.locations.api.views.geo.autocomplete_places', return_value=[suggestion]
        ) as provider:
            response = self.client.get(reverse('geo-autocomplete'), {'q': 'hoan kiem', **ORIGIN})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [(item['type'], item['label']) for item in response.data],
            [('ward', 'Phường Hoàn Kiếm'), ('place', '1 Tràng Tiền')],
        )
        self.assertEqual(response.data[0]['secondary'], 'Thành phố Hà Nội')
        provider.assert_called_once_with('hoan kiem', (21.03, 105.85))
        self.assertEqual(self.client.get(reverse('geo-autocomplete'), {'q': 'h'}).data, [])

    def test_place_resolves_wards_locally_and_provider_refs_through_cache(self):
        url = reverse('geo-place')
        ward = self.client.get(url, {'ref': f'ward:{self.ba_dinh.slug}'})
        self.assertEqual(ward.data['latitude'], 21.0385)
        with mock.patch('apps.locations.api.views.geo.resolve_place', return_value=None):
            self.assertEqual(self.client.get(url, {'ref': 'geoapify:nope'}).status_code, 404)

    def test_ward_lookup_uses_local_centroids(self):
        by_slug = self.client.get(reverse('geo-ward', args=[self.ben_thanh.slug]))
        self.assertEqual(by_slug.data['province_name'], 'Thành phố Hồ Chí Minh')
        self.assertEqual(self.client.get(reverse('geo-ward', args=['khong-co'])).status_code, 404)


class NearbyQueryBudgetTests(NearbyFixture, APITestCase):
    """AGENTS.md: list endpoints keep a flat query count whatever the row count."""

    def _queries(self, url_name):
        with CaptureQueriesContext(connection) as captured:
            response = self.client.get(reverse(url_name), ORIGIN)
        self.assertEqual(response.status_code, 200)
        return len(captured)

    def test_list_and_map_queries_do_not_grow_with_jobs(self):
        for url_name in ('job-nearby-list', 'job-nearby-map'):
            with self.subTest(url_name=url_name):
                Job.objects.all().delete()
                self.job('1', self.ba_dinh)
                self.job('2', self.cau_giay, self.hanoi)
                few = self._queries(url_name)
                for index in range(5):
                    self.job(f'more {index}', self.long_bien, self.hoan_kiem)
                self.assertEqual(self._queries(url_name), few)

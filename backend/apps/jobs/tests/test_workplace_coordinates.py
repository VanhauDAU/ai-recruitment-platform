"""Workplace coordinates (ADR-0029): every way an employer enters a location."""

from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.employers.models import Company
from apps.locations.domain import normalize_geocode_key
from apps.locations.models import GeocodeCache, Location
from apps.locations.services import GeocodingUnavailable, GeoPoint
from common.vietnam_time import vietnam_today

from ..api.serializers import JobLocationSerializer
from ..models import Job, JobLocation
from ..services import refresh_job_coordinates, update_job_record
from ..services.coordinates import geocode_pending_locations, geocode_query

Precision = JobLocation.Precision
Source = JobLocation.CoordinateSource


class GeoFixture:
    @classmethod
    def setUpTestData(cls):
        cls.employer = get_user_model().objects.create_user(
            email='coords@example.com', password='Password@123', role='employer'
        )
        cls.company = Company.objects.create(company_name='Coords Co', created_by=cls.employer)
        cls.hanoi = Location.objects.create(
            code='c-hn', name='Thành phố Hà Nội', level='province', latitude=21.0, longitude=105.7
        )
        cls.hcm = Location.objects.create(
            code='c-hcm',
            name='Thành phố Hồ Chí Minh',
            level='province',
            latitude=10.8,
            longitude=106.7,
        )
        cls.hoan_kiem = Location.objects.create(
            code='c-hk',
            name='Phường Hoàn Kiếm',
            level='ward',
            parent=cls.hanoi,
            latitude=21.0320,
            longitude=105.8504,
        )
        cls.ben_thanh = Location.objects.create(
            code='c-bt',
            name='Phường Bến Thành',
            level='ward',
            parent=cls.hcm,
            latitude=10.7713,
            longitude=106.6937,
        )
        cls.unmapped = Location.objects.create(
            code='c-um', name='Xã Chưa Có Tâm', level='ward', parent=cls.hanoi
        )

    def make_job(self):
        return Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Nhân viên kho',
            description='d',
            requirements='r',
            benefits='b',
            deadline=vietnam_today(),
        )

    def save_locations(self, job, *items):
        update_job_record(job, {'job_locations': list(items)})
        return list(job.job_locations.order_by('sort_order'))

    def cache(self, address_row, point):
        GeocodeCache.objects.create(
            query_key=normalize_geocode_key(geocode_query(address_row)),
            status=GeocodeCache.Status.FOUND if point else GeocodeCache.Status.NOT_FOUND,
            latitude=point[0] if point else None,
            longitude=point[1] if point else None,
            provider='vietmap',
            expires_at='2099-01-01T00:00:00Z',
        )


class AssignCoordinatesTests(GeoFixture, TestCase):
    def test_ward_without_address_uses_the_ward_centroid(self):
        [row] = self.save_locations(self.make_job(), {'location': self.hoan_kiem})
        self.assertEqual((row.latitude, row.longitude), (21.0320, 105.8504))
        self.assertEqual(
            (row.coordinate_precision, row.coordinate_source),
            (Precision.WARD, Source.WARD_CENTROID),
        )
        self.assertFalse(row.geocode_pending)

    def test_whole_province_and_unmapped_ward_get_no_point(self):
        rows = self.save_locations(
            self.make_job(),
            {'location': self.hanoi, 'sort_order': 0},
            {'location': self.unmapped, 'sort_order': 1},
        )
        for row in rows:
            self.assertIsNone(row.latitude)
            self.assertEqual(row.coordinate_precision, Precision.PROVINCE)

    def test_employer_pin_wins_over_everything(self):
        [row] = self.save_locations(
            self.make_job(),
            {
                'location': self.hoan_kiem,
                'address_detail': '1 Tràng Tiền',
                'latitude': 21.0245,
                'longitude': 105.8570,
                'coordinate_source': Source.EMPLOYER_PIN,
            },
        )
        self.assertEqual((row.latitude, row.coordinate_precision), (21.0245, Precision.EXACT))
        self.assertFalse(row.geocode_pending)

    def test_cached_address_in_the_right_province_becomes_exact(self):
        probe = JobLocation(location=self.hoan_kiem, address_detail='1 Tràng Tiền')
        self.cache(probe, (21.0245, 105.8570))
        [row] = self.save_locations(
            self.make_job(), {'location': self.hoan_kiem, 'address_detail': '1 Tràng Tiền'}
        )
        self.assertEqual((row.latitude, row.coordinate_source), (21.0245, Source.GEOCODER))

    def test_cached_result_in_another_province_falls_back_to_ward(self):
        probe = JobLocation(location=self.hoan_kiem, address_detail='Số 1 Lê Lợi')
        self.cache(probe, (10.7740, 106.7010))  # geocoder matched a HCMC street
        [row] = self.save_locations(
            self.make_job(), {'location': self.hoan_kiem, 'address_detail': 'Số 1 Lê Lợi'}
        )
        self.assertEqual(row.coordinate_source, Source.WARD_CENTROID)
        self.assertFalse(row.geocode_pending)

    def test_many_provinces_and_addresses_each_get_their_own_point(self):
        rows = self.save_locations(
            self.make_job(),
            {'location': self.hoan_kiem, 'address_detail': '', 'sort_order': 0},
            {'location': self.ben_thanh, 'address_detail': '', 'sort_order': 1},
            {'location': self.hcm, 'address_detail': '', 'sort_order': 2},
        )
        self.assertEqual(
            [r.coordinate_precision for r in rows],
            [Precision.WARD, Precision.WARD, Precision.PROVINCE],
        )
        self.assertEqual(rows[1].latitude, 10.7713)


@override_settings(GEOCODING_PROVIDER='vietmap', GEOCODING_API_KEY='k')
class BackgroundGeocodingTests(GeoFixture, TestCase):
    def _pending_job(self, address='12 Hàng Bài'):
        job = self.make_job()
        with self.captureOnCommitCallbacks() as callbacks:
            [row] = self.save_locations(
                job, {'location': self.hoan_kiem, 'address_detail': address}
            )
        self.assertTrue(row.geocode_pending)
        self.assertEqual(row.coordinate_source, Source.WARD_CENTROID)  # usable right away
        return job, callbacks

    def test_uncached_address_is_geocoded_after_commit(self):
        job, callbacks = self._pending_job()
        with mock.patch(
            'apps.locations.services.geocoding.VietMapProvider.geocode',
            return_value=GeoPoint(21.0240, 105.8530, '12 Hàng Bài'),
        ) as geocode:
            for callback in callbacks:
                callback()
        row = job.job_locations.get()
        geocode.assert_called_once_with('12 Hàng Bài, Phường Hoàn Kiếm, Thành phố Hà Nội')
        self.assertEqual((row.latitude, row.coordinate_source), (21.0240, Source.GEOCODER))
        self.assertFalse(row.geocode_pending)

    def test_transient_failure_keeps_row_pending_for_retry(self):
        job, _ = self._pending_job()
        with (
            mock.patch(
                'apps.locations.services.geocoding.VietMapProvider.geocode',
                side_effect=GeocodingUnavailable(),
            ),
            self.assertRaises(GeocodingUnavailable),
        ):
            geocode_pending_locations(job.pk)
        self.assertTrue(job.job_locations.get().geocode_pending)

    def test_not_found_or_disabled_provider_settles_on_ward_centroid(self):
        job, _ = self._pending_job()
        with override_settings(GEOCODING_PROVIDER='disabled'):
            self.assertEqual(geocode_pending_locations(job.pk), 0)
        row = job.job_locations.get()
        self.assertFalse(row.geocode_pending)
        self.assertEqual(row.coordinate_precision, Precision.WARD)

    def test_backfill_command_processes_legacy_rows_and_keeps_pins(self):
        job = self.make_job()
        JobLocation.objects.create(job=job, location=self.hoan_kiem)  # legacy: never processed
        JobLocation.objects.create(
            job=job,
            location=self.ben_thanh,
            address_detail='pin',
            latitude=10.77,
            longitude=106.70,
            coordinate_source=Source.EMPLOYER_PIN,
            coordinate_precision=Precision.EXACT,
        )
        with mock.patch('sys.stdout'):
            call_command('refresh_job_coordinates', '--all')
        legacy, pinned = job.job_locations.order_by('pk')
        self.assertEqual(legacy.coordinate_precision, Precision.WARD)
        self.assertEqual((pinned.latitude, pinned.coordinate_source), (10.77, Source.EMPLOYER_PIN))
        refresh_job_coordinates(job)  # idempotent
        self.assertEqual(job.job_locations.get(pk=legacy.pk).latitude, 21.0320)


class EmployerPinValidationTests(GeoFixture, TestCase):
    def _validate(self, location, **pin):
        serializer = JobLocationSerializer(data={'location': location.pk, **pin})
        serializer.is_valid()
        return serializer

    def test_valid_pin_inside_the_selected_province_is_kept(self):
        serializer = self._validate(self.hoan_kiem, latitude=21.02451234, longitude=105.857)
        self.assertEqual(serializer.errors, {})
        self.assertEqual(serializer.validated_data['latitude'], 21.024512)
        self.assertEqual(serializer.validated_data['coordinate_source'], Source.EMPLOYER_PIN)

    def test_pin_requires_both_coordinates_inside_vietnam_and_the_province(self):
        cases = [
            {'latitude': 21.02},
            {'latitude': 13.75, 'longitude': 100.5},
            {'latitude': 10.7713, 'longitude': 106.6937},  # HCMC pin on a Hà Nội ward
        ]
        for pin in cases:
            with self.subTest(pin=pin):
                self.assertIn('latitude', self._validate(self.hoan_kiem, **pin).errors)

    def test_province_wide_row_accepts_a_pin_inside_that_province(self):
        self.assertEqual(
            self._validate(self.hanoi, latitude=21.0330, longitude=105.8490).errors, {}
        )

    def test_without_pin_nothing_is_forced(self):
        serializer = self._validate(self.hoan_kiem, latitude=None, longitude=None)
        self.assertEqual(serializer.errors, {})
        self.assertNotIn('coordinate_source', serializer.validated_data)

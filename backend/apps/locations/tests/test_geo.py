from datetime import timedelta
from unittest import mock

import requests
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from ..domain import (
    bounding_box,
    haversine_km,
    is_in_vietnam,
    normalize_geocode_key,
    polygon_label_point,
    round_coordinate,
)
from ..models import GeocodeCache, Location
from ..selectors import nearest_ward, province_of_point, search_wards, ward_by_slug
from ..services import (
    GeocodingDisabled,
    GeocodingUnavailable,
    autocomplete_places,
    geocode_address,
    get_geocoding_provider,
    resolve_place,
)
from ..services.geocoding import GeoapifyProvider, NominatimProvider, VietMapProvider

HANOI = (21.0285, 105.8542)
HCMC = (10.7769, 106.7009)


class GeoDomainTests(SimpleTestCase):
    def test_haversine_matches_known_city_distance(self):
        self.assertAlmostEqual(haversine_km(*HANOI, *HCMC), 1137, delta=8)
        self.assertEqual(haversine_km(*HANOI, *HANOI), 0)

    def test_bounding_box_contains_the_whole_circle(self):
        box = bounding_box(*HANOI, 10)
        self.assertAlmostEqual(haversine_km(*HANOI, box.north, HANOI[1]), 10, places=3)
        self.assertAlmostEqual(haversine_km(*HANOI, HANOI[0], box.east), 10, delta=0.01)
        self.assertLess(box.south, HANOI[0])
        self.assertLess(box.west, HANOI[1])

    def test_vietnam_bounds_include_islands_and_reject_elsewhere(self):
        self.assertTrue(is_in_vietnam(*HANOI))
        self.assertTrue(is_in_vietnam(16.03, 112.53))  # Hoàng Sa
        self.assertTrue(is_in_vietnam(8.65, 111.92))  # Trường Sa
        self.assertFalse(is_in_vietnam(13.75, 100.5))  # Bangkok
        self.assertFalse(is_in_vietnam(None, 105.0))

    def test_rounding_and_cache_key_normalisation(self):
        self.assertEqual(round_coordinate(21.028512), 21.029)
        self.assertEqual(
            normalize_geocode_key('  12 Đường  Láng', 'Phường Láng '),
            normalize_geocode_key('12 duong lang', 'phuong lang'),
        )

    def test_label_point_stays_inside_concave_ward(self):
        # A "U" shape whose area centroid falls in the empty notch.
        u_shape = {
            'type': 'Polygon',
            'coordinates': [
                [[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]]
            ],
        }
        lat, lng = polygon_label_point(u_shape)
        self.assertFalse(1 < lng < 2 and lat > 1, (lat, lng))

    def test_label_point_uses_largest_part_of_multipolygon(self):
        geometry = {
            'type': 'MultiPolygon',
            'coordinates': [
                [[[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1], [0, 0]]],
                [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]],
            ],
        }
        self.assertEqual(polygon_label_point(geometry), (11.0, 11.0))


def make_ward(name, province, lat, lng, **extra):
    return Location.objects.create(
        code=extra.pop('code', f'w{Location.objects.count()}'),
        name=name,
        level=Location.Level.WARD,
        parent=province,
        latitude=lat,
        longitude=lng,
        **extra,
    )


class GeoSelectorTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.hanoi = Location.objects.create(code='p-hn', name='Thành phố Hà Nội', level='province')
        cls.hcm = Location.objects.create(
            code='p-hcm', name='Thành phố Hồ Chí Minh', level='province'
        )
        cls.hoan_kiem = make_ward('Phường Hoàn Kiếm', cls.hanoi, 21.0320, 105.8504)
        cls.ba_dinh = make_ward('Phường Ba Đình', cls.hanoi, 21.0385, 105.8381)
        cls.ben_thanh = make_ward('Phường Bến Thành', cls.hcm, 10.7713, 106.6937)
        make_ward('Phường Không Tọa Độ', cls.hanoi, None, None)

    def test_nearest_ward_picks_the_closest_centroid(self):
        self.assertEqual(nearest_ward(21.0330, 105.8490), self.hoan_kiem)
        self.assertEqual(nearest_ward(21.0390, 105.8370), self.ba_dinh)
        self.assertEqual(province_of_point(10.78, 106.70), self.hcm)

    def test_nearest_ward_widens_search_then_gives_up(self):
        # ~29 km north of Ba Đình: outside the 5 and 20 km rings, inside 60 km.
        self.assertEqual(nearest_ward(21.30, 105.85), self.ba_dinh)
        self.assertIsNone(nearest_ward(13.75, 100.5))

    def test_search_wards_is_accent_insensitive_and_skips_missing_centroids(self):
        self.assertEqual(search_wards('ben thanh'), [self.ben_thanh])
        self.assertEqual(search_wards('khong toa do'), [])
        self.assertEqual(search_wards('  '), [])
        self.assertEqual(ward_by_slug(self.ba_dinh.slug), self.ba_dinh)


class FakeResponse:
    def __init__(self, payload, status=200):
        self.payload, self.status_code = payload, status

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, params=None, **kwargs):
        self.calls.append((url, params))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


@override_settings(GEOCODING_PROVIDER='vietmap', GEOCODING_API_KEY='test-key')
class GeocodingServiceTests(TestCase):
    def test_geocode_searches_then_resolves_place_and_caches(self):
        session = FakeSession(
            FakeResponse([{'ref_id': 'old', 'data_new': {'ref_id': 'new-ref'}}]),
            FakeResponse({'lat': 21.03, 'lng': 105.85, 'display': '1 Tràng Tiền, Hoàn Kiếm'}),
        )
        provider = VietMapProvider(session=session)

        point = geocode_address('1 Tràng Tiền, Phường Hoàn Kiếm', provider=provider)
        again = geocode_address('1 trang tien, phuong hoan kiem', provider=provider)

        self.assertEqual((point.latitude, point.longitude), (21.03, 105.85))
        self.assertEqual(again, point)
        self.assertEqual(len(session.calls), 2)  # second lookup served from cache
        self.assertEqual(session.calls[1][1]['refid'], 'new-ref')
        self.assertEqual(GeocodeCache.objects.get().status, GeocodeCache.Status.FOUND)

    def test_not_found_and_out_of_country_results_are_cached_as_misses(self):
        session = FakeSession(
            FakeResponse([{'ref_id': 'r1'}]),
            FakeResponse({'lat': 13.75, 'lng': 100.5}),  # Bangkok: rejected
        )
        provider = VietMapProvider(session=session)
        self.assertIsNone(geocode_address('Nowhere', provider=provider))
        self.assertIsNone(geocode_address('nowhere', provider=provider))
        self.assertEqual(GeocodeCache.objects.get().status, GeocodeCache.Status.NOT_FOUND)

    def test_expired_cache_entries_are_refreshed(self):
        GeocodeCache.objects.create(
            query_key=normalize_geocode_key('Stale'),
            status=GeocodeCache.Status.NOT_FOUND,
            provider='vietmap',
            expires_at=timezone.now() - timedelta(days=1),
        )
        session = FakeSession(FakeResponse([]))
        self.assertIsNone(geocode_address('Stale', provider=VietMapProvider(session=session)))
        self.assertEqual(len(session.calls), 1)

    def test_transient_errors_raise_unavailable_without_caching(self):
        for failure in (requests.Timeout(), FakeResponse({}, status=429), FakeResponse({}, 503)):
            provider = VietMapProvider(session=FakeSession(failure))
            with self.assertRaises(GeocodingUnavailable):
                geocode_address('Địa chỉ', provider=provider)
        self.assertFalse(GeocodeCache.objects.exists())

    def test_autocomplete_prefixes_refs_and_place_resolves_them(self):
        session = FakeSession(
            FakeResponse(
                [
                    {
                        'ref_id': 'old',
                        'data_new': {
                            'ref_id': 'abc',
                            'name': '197 Trần Phú',
                            'address': 'Chợ Quán',
                        },
                    }
                ]
            ),
            FakeResponse({'lat': 10.759, 'lng': 106.676, 'display': '197 Trần Phú'}),
        )
        provider = VietMapProvider(session=session)

        [suggestion] = autocomplete_places('197 tran phu', (10.7, 106.6), provider=provider)
        point = resolve_place(suggestion.ref, provider=provider)

        self.assertEqual(suggestion.ref, 'vietmap:abc')
        self.assertEqual(session.calls[0][1]['focus'], '10.7,106.6')
        self.assertEqual((point.latitude, point.longitude), (10.759, 106.676))
        self.assertIsNone(resolve_place('goong:xyz', provider=provider))

    def test_autocomplete_and_place_swallow_provider_failures(self):
        provider = VietMapProvider(session=FakeSession(requests.ConnectionError()))
        self.assertEqual(autocomplete_places('abc', None, provider=provider), [])
        provider = VietMapProvider(session=FakeSession(requests.ConnectionError()))
        self.assertIsNone(resolve_place('vietmap:abc', provider=provider))

    @override_settings(GEOCODING_API_KEY='')
    def test_keyless_commercial_provider_falls_back_to_disabled(self):
        provider = get_geocoding_provider()
        self.assertEqual(provider.name, 'disabled')
        with self.assertRaises(GeocodingDisabled):
            geocode_address('abc')
        self.assertEqual(autocomplete_places('abc'), [])

    @override_settings(GEOCODING_PROVIDER='nominatim')
    def test_nominatim_never_autocompletes(self):
        provider = get_geocoding_provider()
        self.assertIsInstance(provider, NominatimProvider)
        self.assertEqual(provider.autocomplete('abc', None), [])


@override_settings(GEOCODING_PROVIDER='geoapify', GEOCODING_API_KEY='test-key')
class GeoapifyProviderTests(TestCase):
    def test_autocomplete_stays_in_vietnam_and_resolves_without_a_second_request(self):
        session = FakeSession(
            FakeResponse(
                {
                    'results': [
                        {
                            'lat': 10.759,
                            'lon': 106.676,
                            'address_line1': '197 Trần Phú',
                            'address_line2': 'Phường Chợ Quán, Thành phố Hồ Chí Minh',
                        },
                        {'lat': 13.75, 'lon': 100.5, 'address_line1': 'Bangkok'},
                    ]
                }
            )
        )
        provider = GeoapifyProvider(session=session)

        [suggestion] = autocomplete_places('197 tran phu', (10.7, 106.6), provider=provider)
        point = resolve_place(suggestion.ref, provider=provider)

        url, params = session.calls[0]
        self.assertTrue(url.endswith('/autocomplete'))
        self.assertEqual(params['filter'], 'countrycode:vn')
        self.assertEqual(params['bias'], 'proximity:106.6,10.7')  # lon,lat
        self.assertEqual(params['lang'], 'vi')
        self.assertEqual(suggestion.ref, 'geoapify:10.759000,106.676000')
        self.assertEqual(suggestion.secondary, 'Phường Chợ Quán, Thành phố Hồ Chí Minh')
        self.assertEqual((point.latitude, point.longitude), (10.759, 106.676))
        self.assertEqual(len(session.calls), 1)
        self.assertIsNone(resolve_place('geoapify:13.75,100.5', provider=provider))
        self.assertIsNone(resolve_place('geoapify:junk', provider=provider))

    def test_geocode_uses_search_and_caches(self):
        session = FakeSession(
            FakeResponse({'results': [{'lat': 21.03, 'lon': 105.85, 'formatted': '1 Tràng Tiền'}]})
        )
        provider = GeoapifyProvider(session=session)

        point = geocode_address('1 Tràng Tiền, Hoàn Kiếm', provider=provider)
        geocode_address('1 trang tien, hoan kiem', provider=provider)

        self.assertEqual(
            (point.latitude, point.longitude, point.label), (21.03, 105.85, '1 Tràng Tiền')
        )
        self.assertTrue(session.calls[0][0].endswith('/search'))
        self.assertEqual(len(session.calls), 1)

    @override_settings(GEOCODING_API_KEY='')
    def test_needs_a_key(self):
        self.assertEqual(get_geocoding_provider().name, 'disabled')


class SeedCoordinatesCommandTests(TestCase):
    def test_loads_committed_centroids_by_official_code(self):
        hanoi = Location.objects.create(code='1', name='Thành phố Hà Nội', level='province')
        ba_dinh = Location.objects.create(
            code='00004', name='Phường Ba Đình', level='ward', parent=hanoi
        )
        unknown = Location.objects.create(code='zz-test', name='Không có', level='province')

        with mock.patch('sys.stdout'):
            call_command('seed_location_coordinates')

        for location in (hanoi, ba_dinh):
            location.refresh_from_db()
            self.assertTrue(is_in_vietnam(location.latitude, location.longitude))
            self.assertEqual(location.centroid_source, 'boundary')
        self.assertLess(haversine_km(ba_dinh.latitude, ba_dinh.longitude, 21.0385, 105.8381), 2)
        unknown.refresh_from_db()
        self.assertIsNone(unknown.latitude)


class SeedLocationsWardCodeTests(TestCase):
    def test_ward_codes_are_padded_so_they_never_overwrite_a_province(self):
        responses = {
            'https://provinces.open-api.vn/api/v2/p/': [
                {'code': 1, 'name': 'Thành phố Hà Nội', 'division_type': 'thành phố'},
                {'code': 4, 'name': 'Tỉnh Cao Bằng', 'division_type': 'tỉnh'},
            ],
            'https://provinces.open-api.vn/api/v2/p/1?depth=2': {
                'wards': [{'code': 4, 'name': 'Phường Ba Đình', 'division_type': 'phường'}]
            },
            'https://provinces.open-api.vn/api/v2/p/4?depth=2': {'wards': []},
        }
        with (
            mock.patch(
                'apps.locations.management.commands.seed_locations.fetch_json',
                side_effect=responses.__getitem__,
            ),
            mock.patch('sys.stdout'),
        ):
            call_command('seed_locations')

        self.assertEqual(Location.objects.get(code='4').name, 'Tỉnh Cao Bằng')
        self.assertEqual(Location.objects.get(code='00004').parent.code, '1')

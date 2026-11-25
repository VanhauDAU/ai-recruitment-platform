from django.urls import reverse
from rest_framework.test import APITestCase

from ..models import Location


class LocationLookupApiTests(APITestCase):
    def test_lookup_returns_picker_fields_only(self):
        province = Location.objects.create(
            code='01-contract',
            name='Hà Nội',
            level=Location.Level.PROVINCE,
            merged_from=['Hà Tây'],
        )
        Location.objects.create(
            code='00001-contract',
            name='Phường Ba Đình',
            level=Location.Level.WARD,
            parent=province,
        )

        response = self.client.get(reverse('location-list'), {'level': Location.Level.PROVINCE})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            set(response.data[0]),
            {'id', 'name', 'level', 'parent', 'merged_from', 'latitude', 'longitude'},
        )
        self.assertTrue({'code', 'slug', 'ward_type', 'province_type'}.isdisjoint(response.data[0]))


class LocationLookupFilterTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.hanoi = Location.objects.create(code='01-t', name='Hà Nội', level='province')
        cls.hue = Location.objects.create(code='46-t', name='Huế', level='province')
        cls.ba_dinh = Location.objects.create(
            code='00004-t', name='Phường Ba Đình', level='ward', parent=cls.hanoi
        )
        cls.hoan_kiem = Location.objects.create(
            code='00070-t', name='Phường Hoàn Kiếm', level='ward', parent=cls.hanoi
        )
        cls.thuan_hoa = Location.objects.create(
            code='19753-t', name='Phường Thuận Hóa', level='ward', parent=cls.hue
        )
        cls.retired = Location.objects.create(
            code='99-t', name='Hà Tây', level='province', is_active=False
        )

    def _names(self, **params):
        response = self.client.get(reverse('location-list'), params)
        self.assertEqual(response.status_code, 200)
        return [item['name'] for item in response.data]

    def test_wards_cascade_from_one_or_many_parents_in_name_order(self):
        self.assertEqual(
            self._names(level='ward', parent=self.hanoi.pk),
            ['Phường Ba Đình', 'Phường Hoàn Kiếm'],
        )
        self.assertEqual(
            self._names(level='ward', parent=f'{self.hue.pk},{self.hanoi.pk}'),
            ['Phường Ba Đình', 'Phường Hoàn Kiếm', 'Phường Thuận Hóa'],
        )

    def test_non_numeric_parent_returns_nothing_instead_of_every_ward(self):
        self.assertEqual(self._names(level='ward', parent='abc'), [])

    def test_ids_lookup_ignores_other_filters_and_orders_provinces_first(self):
        names = self._names(
            ids=f'{self.thuan_hoa.pk}, {self.hue.pk},x',
            level='ward',
            search='zzz',
        )

        self.assertEqual(names, ['Huế', 'Phường Thuận Hóa'])

    def test_search_is_case_insensitive_and_inactive_locations_are_hidden(self):
        self.assertEqual(self._names(search='hoàn kiếm'), ['Phường Hoàn Kiếm'])
        self.assertEqual(self._names(level='province'), ['Hà Nội', 'Huế'])
        self.assertEqual(self._names(ids=str(self.retired.pk)), [])

    def test_ward_payload_exposes_its_parent_id(self):
        response = self.client.get(reverse('location-list'), {'ids': self.ba_dinh.pk})

        self.assertEqual(
            response.data,
            [
                {
                    'id': self.ba_dinh.pk,
                    'name': 'Phường Ba Đình',
                    'level': 'ward',
                    'parent': self.hanoi.pk,
                    'merged_from': [],
                    'latitude': None,
                    'longitude': None,
                }
            ],
        )

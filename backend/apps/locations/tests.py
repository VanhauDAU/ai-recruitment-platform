from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Location


class LocationLookupApiTests(APITestCase):
    def test_lookup_returns_picker_fields_only(self):
        province = Location.objects.create(
            code='01-contract', name='Hà Nội', level=Location.Level.PROVINCE,
            merged_from=['Hà Tây'],
        )
        Location.objects.create(
            code='00001-contract', name='Phường Ba Đình',
            level=Location.Level.WARD, parent=province,
        )

        response = self.client.get(reverse('location-list'), {'level': Location.Level.PROVINCE})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(set(response.data[0]), {'id', 'name', 'level', 'parent', 'merged_from'})
        self.assertTrue({'code', 'slug', 'ward_type', 'province_type'}.isdisjoint(response.data[0]))

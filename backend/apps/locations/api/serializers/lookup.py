from rest_framework import serializers

from ...models import Location


class LocationLookupSerializer(serializers.ModelSerializer):
    """Compact address-option DTO shared by province and ward pickers."""

    class Meta:
        model = Location
        # latitude/longitude: tâm phường/tỉnh để form NTD đặt ghim ban đầu (ADR-0029).
        fields = ['id', 'name', 'level', 'parent', 'merged_from', 'latitude', 'longitude']
        read_only_fields = fields

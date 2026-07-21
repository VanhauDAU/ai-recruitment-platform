from rest_framework import serializers

from ...models import Location


class LocationLookupSerializer(serializers.ModelSerializer):
    """Compact address-option DTO shared by province and ward pickers."""

    class Meta:
        model = Location
        fields = ['id', 'name', 'level', 'parent', 'merged_from']
        read_only_fields = fields

from rest_framework import serializers


class GeoSuggestionSerializer(serializers.Serializer):
    """One autocomplete option: a ward (coordinates known locally) or a provider
    place that needs ``/geo/place/`` to resolve its coordinates."""

    type = serializers.ChoiceField(choices=['ward', 'place'])
    ref = serializers.CharField()
    label = serializers.CharField()
    secondary = serializers.CharField(allow_blank=True)
    latitude = serializers.FloatField(allow_null=True)
    longitude = serializers.FloatField(allow_null=True)
    slug = serializers.CharField(allow_blank=True)


class GeoPointSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    label = serializers.CharField(allow_blank=True)


class GeoPlaceLabelSerializer(serializers.Serializer):
    ward_id = serializers.IntegerField()
    ward_name = serializers.CharField()
    ward_slug = serializers.CharField()
    province_id = serializers.IntegerField()
    province_name = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

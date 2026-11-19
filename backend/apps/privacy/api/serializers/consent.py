from rest_framework import serializers


class ConsentSerializer(serializers.Serializer):
    """Only optional categories are client-controlled; necessary stays enabled."""

    preferences = serializers.BooleanField(default=False)
    analytics = serializers.BooleanField(default=False)
    marketing = serializers.BooleanField(default=False)

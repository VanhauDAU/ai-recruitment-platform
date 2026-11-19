"""Shared-link contracts; the raw bearer token is never part of a stored representation."""

from django.utils import timezone
from rest_framework import serializers

from apps.cvs.models import CvSharedLink


class CvSharedLinkCreateSerializer(serializers.Serializer):
    version_public_id = serializers.CharField(max_length=50, required=False, allow_blank=False)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_expires_at(self, value):
        if value is not None and value <= timezone.now():
            raise serializers.ValidationError('Expiry must be in the future.')
        return value


class CvSharedLinkSerializer(serializers.ModelSerializer):
    version_public_id = serializers.CharField(source='version.public_id', read_only=True)

    class Meta:
        model = CvSharedLink
        fields = [
            'public_id',
            'version_public_id',
            'expires_at',
            'revoked_at',
            'last_accessed_at',
            'created_at',
        ]
        read_only_fields = fields

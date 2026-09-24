from django.conf import settings
from rest_framework import serializers

from apps.uploads.models import UploadState


class UploadSessionCreateSerializer(serializers.Serializer):
    purpose = serializers.CharField(max_length=64)
    original_filename = serializers.CharField(max_length=255)
    content_type = serializers.CharField(max_length=127)
    size_bytes = serializers.IntegerField(min_value=1)


class UploadContentSerializer(serializers.Serializer):
    file = serializers.FileField()


class UploadSessionSerializer(serializers.Serializer):
    public_id = serializers.CharField(read_only=True)
    purpose = serializers.CharField(read_only=True)
    original_filename = serializers.CharField(read_only=True)
    content_type = serializers.SerializerMethodField()
    size_bytes = serializers.SerializerMethodField()
    state = serializers.CharField(read_only=True)
    result_code = serializers.CharField(source='scan_result_code', read_only=True)
    scan_attempts = serializers.IntegerField(read_only=True)
    retryable = serializers.SerializerMethodField()
    ready_for_submit = serializers.SerializerMethodField()
    expires_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def get_content_type(self, obj) -> str:
        return obj.detected_content_type or obj.declared_content_type

    def get_size_bytes(self, obj) -> int:
        return obj.size_bytes or obj.expected_size_bytes

    def get_retryable(self, obj) -> bool:
        return (
            obj.state == UploadState.ERROR and obj.scan_attempts < settings.UPLOAD_SCAN_MAX_ATTEMPTS
        )

    def get_ready_for_submit(self, obj) -> bool:
        asset = getattr(obj, 'asset', None)
        return bool(
            obj.state == UploadState.CLEAN
            and asset is not None
            and asset.deleted_at is None
            and asset.storage_key
            and asset.claimed_at is None
        )


class UploadErrorSerializer(serializers.Serializer):
    code = serializers.CharField()
    message = serializers.CharField()
    retryable = serializers.BooleanField()

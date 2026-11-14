from rest_framework import serializers

from ...page_registry import (
    ACCENT_PALETTE,
    HIDEABLE_SECTION_KEYS,
    MAIN_SECTION_KEYS,
    SECTION_TITLES,
)


class CompanyPageLayoutSerializer(serializers.Serializer):
    """Validates a layout change against the page registry."""

    lock_version = serializers.IntegerField(min_value=0)
    section_order = serializers.ListField(child=serializers.CharField(), required=False)
    hidden_sections = serializers.ListField(child=serializers.CharField(), required=False)
    accent = serializers.CharField(required=False)
    pinned_job_public_ids = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
    )

    def validate_section_order(self, value):
        if sorted(value) != sorted(MAIN_SECTION_KEYS):
            raise serializers.ValidationError(
                'Thứ tự phải gồm đúng một lần mỗi khối của vùng nội dung chính.'
            )
        return value

    def validate_accent(self, value):
        if value not in ACCENT_PALETTE:
            raise serializers.ValidationError('Màu nhấn không có trong bảng màu của trang công ty.')
        return value

    def validate_hidden_sections(self, value):
        if unknown := set(value) - set(SECTION_TITLES):
            raise serializers.ValidationError(f'Khối không tồn tại: {", ".join(sorted(unknown))}.')
        if locked := set(value) - HIDEABLE_SECTION_KEYS:
            raise serializers.ValidationError(
                f'Không thể ẩn khối luôn hiển thị: {", ".join(sorted(locked))}.'
            )
        # Registry order without repeats, so equal choices always compare equal.
        return [key for key in SECTION_TITLES if key in value]


class CompanyPageEditorGrantSerializer(serializers.Serializer):
    member_id = serializers.CharField(max_length=50)

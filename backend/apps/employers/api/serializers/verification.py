from rest_framework import serializers

from common.media_storage import media_url_from_value

from ...models import CompanyDocument, CompanyUpdateRequest
from ...services import SENSITIVE_FIELDS, UPDATABLE_COMPANY_FIELDS


class CompanyDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = CompanyDocument
        fields = ['id', 'doc_type', 'file_url', 'file_name', 'status', 'review_note', 'created_at']
        read_only_fields = ['id', 'file_url', 'file_name', 'status', 'review_note', 'created_at']

    def get_file_url(self, obj):
        return media_url_from_value(obj.file_url, request=self.context.get('request'))


class CompanyUpdateRequestSerializer(serializers.ModelSerializer):
    documents = CompanyDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = CompanyUpdateRequest
        fields = [
            'public_id', 'changes', 'is_sensitive', 'reason', 'proof_type',
            'status', 'review_note', 'documents', 'created_at',
        ]
        read_only_fields = ['public_id', 'is_sensitive', 'status', 'review_note', 'created_at']

    def validate_changes(self, value):
        if not value:
            raise serializers.ValidationError('Chưa có thay đổi nào.')
        allowed = UPDATABLE_COMPANY_FIELDS | {'industries', 'primary_industry'}
        invalid = set(value) - allowed
        if invalid:
            raise serializers.ValidationError(f'Trường không được phép cập nhật: {", ".join(sorted(invalid))}')
        return value

    def validate(self, attrs):
        # Đổi MST/tên công ty phải kèm lý do + loại giấy tờ chứng minh.
        sensitive = bool(SENSITIVE_FIELDS & set(attrs.get('changes', {})))
        if sensitive:
            if not attrs.get('reason'):
                raise serializers.ValidationError({'reason': 'Nhập lý do khi thay đổi Mã số thuế hoặc Tên công ty.'})
            if not attrs.get('proof_type'):
                raise serializers.ValidationError({'proof_type': 'Chọn loại giấy tờ chứng minh khi thay đổi Mã số thuế hoặc Tên công ty.'})
        attrs['is_sensitive'] = sensitive
        return attrs


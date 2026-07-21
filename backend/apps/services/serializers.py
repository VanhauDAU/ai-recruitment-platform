import re

from rest_framework import serializers

from .models import ConsultationLead, ServiceCategory, ServicePackage

_PHONE = re.compile(r'^[0-9+ .()-]{8,20}$')

PACKAGE_PUBLIC_FIELDS = [
    'slug',
    'name_vi',
    'name_en',
    'tagline_vi',
    'tagline_en',
    'price',
    'currency',
    'unit_vi',
    'unit_en',
    'vat_note_vi',
    'vat_note_en',
    'benefits_vi',
    'benefits_en',
    'badge_vi',
    'badge_en',
    'is_highlight',
    'cta_type',
]


class PublicServicePackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServicePackage
        fields = PACKAGE_PUBLIC_FIELDS


class PublicServiceCategorySerializer(serializers.ModelSerializer):
    """Nhóm dịch vụ kèm các gói active; view đã prefetch sẵn `active_packages`."""

    packages = PublicServicePackageSerializer(source='active_packages', many=True, read_only=True)

    class Meta:
        model = ServiceCategory
        fields = [
            'key',
            'name_vi',
            'name_en',
            'description_vi',
            'description_en',
            'icon',
            'packages',
        ]


def _validate_benefits(value):
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise serializers.ValidationError('Quyền lợi phải là danh sách chuỗi.')
    return [item.strip() for item in value if item.strip()]


class AdminServiceCategorySerializer(serializers.ModelSerializer):
    packages_count = serializers.IntegerField(source='packages.count', read_only=True)

    class Meta:
        model = ServiceCategory
        fields = [
            'id',
            'key',
            'name_vi',
            'name_en',
            'description_vi',
            'description_en',
            'icon',
            'order',
            'is_active',
            'packages_count',
        ]


class AdminServicePackageSerializer(serializers.ModelSerializer):
    category_key = serializers.SlugField(source='category.key', read_only=True)

    class Meta:
        model = ServicePackage
        fields = [
            'id',
            'category',
            'category_key',
            'order',
            'is_active',
            'created_at',
            'updated_at',
            *PACKAGE_PUBLIC_FIELDS,
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_benefits_vi(self, value):
        return _validate_benefits(value)

    def validate_benefits_en(self, value):
        return _validate_benefits(value)


class ConsultationLeadCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsultationLead
        fields = [
            'id',
            'full_name',
            'company_name',
            'email',
            'phone',
            'province',
            'need',
            'note',
            'source_page',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'full_name': {'trim_whitespace': True},
            'note': {'max_length': 2000},
        }

    def validate_phone(self, value):
        value = value.strip()
        if not _PHONE.match(value):
            raise serializers.ValidationError('Số điện thoại không hợp lệ.')
        return value


class AdminConsultationLeadSerializer(serializers.ModelSerializer):
    need_label = serializers.CharField(source='get_need_display', read_only=True)

    class Meta:
        model = ConsultationLead
        fields = [
            'id',
            'full_name',
            'company_name',
            'email',
            'phone',
            'province',
            'need',
            'need_label',
            'note',
            'source_page',
            'status',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'full_name',
            'company_name',
            'email',
            'phone',
            'province',
            'need',
            'note',
            'source_page',
            'created_at',
        ]

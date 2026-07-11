from rest_framework import serializers

from common.media_storage import media_url_from_value

from ...models import Company, CompanyDocument, CompanyImage, CompanyUpdateRequest, Industry, RecruiterProfile
from ...services import SENSITIVE_FIELDS, UPDATABLE_COMPANY_FIELDS, set_company_industries


class IndustrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Industry
        fields = ['id', 'name', 'slug']


class CompanyImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = CompanyImage
        fields = ['id', 'image_url', 'caption', 'sort_order']

    def get_image_url(self, obj):
        return media_url_from_value(obj.image_url, request=self.context.get('request'))


class CompanySerializer(serializers.ModelSerializer):
    """Hồ sơ công ty đầy đủ. Ghi: tạo mới (POST) — cập nhật về sau đi qua
    CompanyUpdateRequest chứ không PATCH trực tiếp (trừ ảnh, upload riêng)."""

    industries = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Industry.objects.all()
    )
    primary_industry = serializers.PrimaryKeyRelatedField(write_only=True, queryset=Industry.objects.all())
    industries_detail = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    images = CompanyImageSerializer(many=True, read_only=True)

    class Meta:
        model = Company
        fields = [
            'id', 'public_id', 'slug', 'business_type', 'tax_code', 'company_name',
            'trade_name', 'trade_name_same_as_registered', 'logo_url', 'has_no_logo',
            'cover_image_url', 'website_url', 'has_no_website', 'email', 'phone',
            'address', 'company_size', 'description', 'employee_benefits',
            'markets', 'target_customers', 'industries', 'primary_industry',
            'industries_detail', 'founded_year', 'has_brand_page',
            'verification_status', 'verified_at', 'rejected_reason', 'images',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'public_id', 'slug', 'has_brand_page', 'verification_status',
            'verified_at', 'rejected_reason', 'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'tax_code': {'required': True, 'allow_null': False},
            'email': {'required': True},
            'phone': {'required': True},
            'address': {'required': True},
            'company_size': {'required': True},
            'description': {'required': True},
        }

    def get_industries_detail(self, obj):
        return [
            {'id': item.industry.id, 'name': item.industry.name,
             'slug': item.industry.slug, 'is_primary': item.is_primary}
            for item in obj.company_industries.select_related('industry')
        ]

    def get_logo_url(self, obj):
        return media_url_from_value(obj.logo_url, request=self.context.get('request'))

    def get_cover_image_url(self, obj):
        return media_url_from_value(obj.cover_image_url, request=self.context.get('request'))

    def _validate_enum_list(self, value, choices, label):
        invalid = set(value) - set(choices.values)
        if invalid:
            raise serializers.ValidationError(f'Giá trị {label} không hợp lệ: {", ".join(sorted(invalid))}')
        return value

    def validate_markets(self, value):
        return self._validate_enum_list(value, Company.Market, 'thị trường')

    def validate_target_customers(self, value):
        return self._validate_enum_list(value, Company.TargetCustomer, 'khách hàng mục tiêu')

    def validate(self, attrs):
        if attrs.get('primary_industry') not in attrs.get('industries', []):
            raise serializers.ValidationError({'primary_industry': 'Lĩnh vực chính phải nằm trong các lĩnh vực hoạt động đã chọn.'})
        if not attrs.get('website_url') and not attrs.get('has_no_website'):
            raise serializers.ValidationError({'website_url': 'Nhập URL website hoặc tick "Tôi không có website".'})
        return attrs

    def create(self, validated_data):
        industries = validated_data.pop('industries')
        primary_industry = validated_data.pop('primary_industry')
        company = Company.objects.create(**validated_data)
        set_company_industries(company, industries, primary_industry)
        return company


class CompanySearchSerializer(serializers.ModelSerializer):
    """Kết quả tìm công ty có sẵn (thẻ 1 luồng onboarding): tên, MST, địa chỉ,
    quy mô, lĩnh vực."""

    logo_url = serializers.SerializerMethodField()
    industries_detail = IndustrySerializer(source='industries', many=True, read_only=True)

    class Meta:
        model = Company
        fields = [
            'public_id', 'company_name', 'trade_name', 'tax_code', 'address',
            'company_size', 'logo_url', 'industries_detail', 'verification_status',
        ]

    def get_logo_url(self, obj):
        return media_url_from_value(obj.logo_url, request=self.context.get('request'))


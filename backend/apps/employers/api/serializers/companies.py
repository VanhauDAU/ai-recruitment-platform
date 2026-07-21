import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers

from common.media_storage import media_url_from_value
from common.rich_text import rich_text_plain_text, sanitize_rich_text

from ...models import (
    Company,
    CompanyDocument,
    CompanyImage,
    CompanyUpdateRequest,
    Industry,
    RecruiterProfile,
)
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
    primary_industry = serializers.PrimaryKeyRelatedField(
        write_only=True, queryset=Industry.objects.all()
    )
    industries_detail = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    images = CompanyImageSerializer(many=True, read_only=True)
    primary_industry_id = serializers.SerializerMethodField()
    # Workflow tạo công ty lưu record trước rồi mới upload logo. Cờ này cho
    # phép API xác thực ý định mà không phải lưu trạng thái trung gian vào DB.
    logo_pending = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = Company
        fields = [
            'id',
            'public_id',
            'slug',
            'business_type',
            'tax_code',
            'company_name',
            'trade_name',
            'trade_name_same_as_registered',
            'logo_url',
            'has_no_logo',
            'cover_image_url',
            'website_url',
            'has_no_website',
            'email',
            'phone',
            'address',
            'company_size',
            'description',
            'employee_benefits',
            'markets',
            'target_customers',
            'industries',
            'primary_industry',
            'primary_industry_id',
            'industries_detail',
            'founded_year',
            'has_brand_page',
            'logo_pending',
            'verification_status',
            'verified_at',
            'rejected_reason',
            'images',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'public_id',
            'slug',
            'has_brand_page',
            'verification_status',
            'verified_at',
            'rejected_reason',
            'created_at',
            'updated_at',
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
            {
                'id': item.industry.id,
                'name': item.industry.name,
                'slug': item.industry.slug,
                'is_primary': item.is_primary,
            }
            for item in obj.company_industries.select_related('industry')
        ]

    def get_primary_industry_id(self, obj):
        primary = next((item for item in obj.company_industries.all() if item.is_primary), None)
        return primary.industry_id if primary else None

    def get_logo_url(self, obj):
        return media_url_from_value(obj.logo_url, request=self.context.get('request'))

    def get_cover_image_url(self, obj):
        return media_url_from_value(obj.cover_image_url, request=self.context.get('request'))

    def _validate_enum_list(self, value, choices, label):
        invalid = set(value) - set(choices.values)
        if invalid:
            raise serializers.ValidationError(
                f'Giá trị {label} không hợp lệ: {", ".join(sorted(invalid))}'
            )
        return value

    def validate_markets(self, value):
        return self._validate_enum_list(value, Company.Market, 'thị trường')

    def validate_target_customers(self, value):
        return self._validate_enum_list(value, Company.TargetCustomer, 'khách hàng mục tiêu')

    def validate_tax_code(self, value):
        value = re.sub(r'\s+', '', value or '')
        if not re.fullmatch(r'\d{10}(?:-\d{3})?', value):
            raise serializers.ValidationError(
                'Mã số thuế phải gồm 10 chữ số hoặc có dạng 10 chữ số-3 chữ số.'
            )
        return value

    def validate_company_name(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Tên đăng ký kinh doanh là bắt buộc.')
        return value

    def validate_phone(self, value):
        value = (value or '').strip()
        if not re.fullmatch(r'\+?[0-9 .()\-]{8,20}', value):
            raise serializers.ValidationError('Số điện thoại không hợp lệ.')
        return value

    def validate_website_url(self, value):
        value = (value or '').strip()
        if value:
            try:
                URLValidator(schemes=['http', 'https'])(value)
            except DjangoValidationError as error:
                raise serializers.ValidationError('URL website không hợp lệ.') from error
        return value

    def _validate_rich_text(self, value, *, required, label):
        sanitized = sanitize_rich_text(value)
        visible = rich_text_plain_text(sanitized)
        if required and not visible:
            raise serializers.ValidationError(f'{label} là bắt buộc.')
        if len(visible) > 10_000:
            raise serializers.ValidationError(f'{label} không được vượt quá 10.000 ký tự.')
        return sanitized

    def validate_description(self, value):
        return self._validate_rich_text(value, required=True, label='Mô tả công ty')

    def validate_employee_benefits(self, value):
        return self._validate_rich_text(value, required=False, label='Phúc lợi nhân viên')

    def validate(self, attrs):
        instance = self.instance
        industries = attrs.get('industries')
        primary_industry = attrs.get('primary_industry')
        if industries is not None and primary_industry not in industries:
            raise serializers.ValidationError(
                {
                    'primary_industry': 'Lĩnh vực chính phải nằm trong các lĩnh vực hoạt động đã chọn.'
                }
            )

        website_url = attrs.get('website_url', getattr(instance, 'website_url', ''))
        has_no_website = attrs.get('has_no_website', getattr(instance, 'has_no_website', False))
        if not website_url and not has_no_website:
            raise serializers.ValidationError(
                {'website_url': 'Nhập URL website hoặc tick "Tôi không có website".'}
            )

        company_name = attrs.get('company_name', getattr(instance, 'company_name', ''))
        same_trade_name = attrs.get(
            'trade_name_same_as_registered',
            getattr(instance, 'trade_name_same_as_registered', False),
        )
        if same_trade_name:
            attrs['trade_name'] = company_name
        elif (
            'trade_name_same_as_registered' in attrs and not (attrs.get('trade_name') or '').strip()
        ):
            raise serializers.ValidationError(
                {'trade_name': 'Nhập tên thương mại hoặc chọn trùng tên đăng ký kinh doanh.'}
            )

        if attrs.get('logo_pending') is False and not attrs.get('has_no_logo'):
            raise serializers.ValidationError(
                {'has_no_logo': 'Tải logo hoặc chọn "Tôi không có logo".'}
            )

        tax_code = attrs.get('tax_code')
        if tax_code:
            duplicate = Company.objects.filter(tax_code=tax_code)
            if instance:
                duplicate = duplicate.exclude(pk=instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError(
                    {'tax_code': 'Mã số thuế này đã tồn tại trong hệ thống.'}
                )
        return attrs

    def create(self, validated_data):
        industries = validated_data.pop('industries')
        primary_industry = validated_data.pop('primary_industry')
        validated_data.pop('logo_pending', None)
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
            'public_id',
            'company_name',
            'trade_name',
            'tax_code',
            'address',
            'company_size',
            'logo_url',
            'industries_detail',
            'verification_status',
        ]

    def get_logo_url(self, obj):
        return media_url_from_value(obj.logo_url, request=self.context.get('request'))

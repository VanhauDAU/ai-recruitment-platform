from django.core.validators import RegexValidator
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import password_field
from apps.locations.models import Location

from ...models import RecruiterProfile


phone_validator = RegexValidator(
    regex=r'^(0|\+84)\d{9,10}$',
    message='Số điện thoại không hợp lệ (VD: 0912345678 hoặc +84912345678).',
)


class EmployerRegistrationProfileSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, trim_whitespace=True)
    gender = serializers.ChoiceField(choices=RecruiterProfile.Gender.choices)
    contact_phone = serializers.CharField(max_length=20, validators=[phone_validator])
    work_location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.filter(level=Location.Level.PROVINCE, is_active=True),
    )
    terms_accepted = serializers.BooleanField()
    marketing_opt_in = serializers.BooleanField(required=False, default=False)

    def validate_full_name(self, value):
        if len(value) < 2:
            raise serializers.ValidationError('Họ và tên cần ít nhất 2 ký tự.')
        return value

    def validate_contact_phone(self, value):
        return value.replace(' ', '').replace('.', '').replace('-', '')

    def validate_terms_accepted(self, value):
        if value is not True:
            raise serializers.ValidationError(
                'Bạn cần đồng ý Điều khoản dịch vụ và Chính sách quyền riêng tư.'
            )
        return value


class EmployerRegisterSerializer(EmployerRegistrationProfileSerializer):
    email = serializers.EmailField()
    password = password_field()
    captcha_token = serializers.CharField(write_only=True)

    def validate_email(self, value):
        value = User.objects.normalize_email(value)
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Email này đã được sử dụng cho tài khoản khác.')
        return value

from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.validators import RegexValidator
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from common.media_storage import media_url_from_value

from .models import User
from .services.access import is_account_accessible


def password_field():
    """Cùng một bộ rule mật khẩu cho đăng ký và đặt lại mật khẩu."""
    return serializers.CharField(
        write_only=True,
        max_length=25,
        validators=[
            validate_password,
            RegexValidator(
                regex=r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$',
                message='Mật khẩu phải bao gồm chữ hoa, chữ thường và ký tự số.',
            ),
        ],
    )


class RegisterSerializer(serializers.ModelSerializer):
    password = password_field()
    role = serializers.ChoiceField(choices=[User.Role.CANDIDATE, User.Role.EMPLOYER])
    captcha_token = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'password', 'role', 'full_name', 'captcha_token']
        extra_kwargs = {'full_name': {'required': False}}

    def validate_email(self, value):
        """Chuẩn hoá + chặn trùng không phân biệt hoa/thường.

        `UniqueValidator` mặc định của ModelSerializer so sánh phân biệt hoa/thường
        nên `Hau@gmail.com` lọt qua dù đã có `hau@gmail.com`, rồi vỡ ở ràng buộc
        `uniq_users_email_lower` dưới DB thành lỗi 500.
        """
        value = User.objects.normalize_email(value)
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Email này đã được sử dụng cho tài khoản khác.')
        return value

    def create(self, validated_data):
        validated_data.pop('captcha_token', None)
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'public_id', 'email', 'role', 'full_name', 'phone', 'avatar_url',
            'status', 'email_verified', 'date_joined', 'last_login',
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj):
        return media_url_from_value(obj.avatar_url, request=self.context.get('request'))


class ChangeEmailSerializer(serializers.Serializer):
    """Đổi email khi tài khoản chưa xác thực (reset email_verified và gửi lại link)."""

    email = serializers.EmailField()

    def validate_email(self, value):
        value = User.objects.normalize_email(value)
        user = self.context['request'].user
        if value.lower() == user.email.lower():
            raise serializers.ValidationError('Email mới trùng với email hiện tại.')
        if User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError('Email này đã được sử dụng cho tài khoản khác.')
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Yêu cầu gửi link đặt lại mật khẩu. Không kiểm tra email có tồn tại hay
    không — view luôn trả cùng một thông điệp để tránh lộ danh sách email."""

    email = serializers.EmailField()
    captcha_token = serializers.CharField(write_only=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Đổi token trong link lấy mật khẩu mới. Token đã đủ vai trò xác thực nên
    không cần captcha ở bước này."""

    token = serializers.CharField(write_only=True)
    password = password_field()


# Mỗi cổng đăng nhập (main / tuyendung / admin) chỉ chấp nhận role tương ứng.
PORTAL_ROLES = {
    'main': [User.Role.CANDIDATE],
    'employer': [User.Role.EMPLOYER],
    'admin': [User.Role.ADMIN],
}


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds role/email claims to the JWT so the frontend can route by role
    without an extra profile lookup. Optional `portal` rejects wrong-role
    logins per portal (backward compatible: no portal -> no check)."""

    default_error_messages = {
        **TokenObtainPairSerializer.default_error_messages,
        'no_active_account': 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
    }

    captcha_token = serializers.CharField(write_only=True)
    portal = serializers.ChoiceField(choices=list(PORTAL_ROLES), required=False, write_only=True)

    def validate(self, attrs):
        attrs.pop('captcha_token', None)
        portal = attrs.pop('portal', None)
        data = super().validate(attrs)
        if not is_account_accessible(self.user):
            raise AuthenticationFailed(self.error_messages['no_active_account'], 'no_active_account')
        if portal and self.user.role not in PORTAL_ROLES[portal]:
            raise serializers.ValidationError({'detail': 'Tài khoản không có quyền truy cập cổng này.'})
        update_last_login(None, self.user)
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['email'] = user.email
        return token

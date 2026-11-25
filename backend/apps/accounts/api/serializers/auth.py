"""Registration, login and password contracts."""

from django.contrib.auth.password_validation import validate_password
from django.core.validators import RegexValidator
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenObtainSerializer

from ...models import User
from ...services import login_guard, password_setup_code
from ...services.access import is_account_accessible
from ...services.refresh_cookies import PORTAL_ROLE_BY_NAME

# Role tự đăng ký được; tài khoản admin chỉ tạo qua lời mời.
SELF_SERVICE_ROLES = (User.Role.CANDIDATE, User.Role.EMPLOYER)


def password_field():
    """Cùng một bộ rule mật khẩu cho đăng ký và đặt lại mật khẩu."""
    return serializers.CharField(
        write_only=True,
        max_length=25,
        validators=[
            validate_password,
            RegexValidator(
                regex=r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$',
                message=gettext_lazy('Mật khẩu phải bao gồm chữ hoa, chữ thường và ký tự số.'),
            ),
        ],
    )


def admin_access_payload(user):
    """Cấp quản trị của tài khoản admin (ADR-0018: superuser hoặc admin thường)."""

    if not user.is_admin_role:
        return None
    return {'is_superuser': bool(user.is_superuser)}


class RegisterSerializer(serializers.ModelSerializer):
    password = password_field()
    role = serializers.ChoiceField(choices=SELF_SERVICE_ROLES)
    captcha_token = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'role', 'full_name', 'captcha_token']
        extra_kwargs = {'full_name': {'required': False}}

    def validate_email(self, value):
        # Chỉ chuẩn hoá; tính duy nhất kiểm ở `validate()` vì phụ thuộc cả `role`.
        return User.objects.normalize_email(value)

    def validate(self, attrs):
        """Chặn trùng theo (email, role): cùng email vẫn đăng ký được ở cổng khác.

        Mô hình tách cổng — một email có thể có tài khoản ứng viên và NTD riêng.
        """
        if User.objects.email_claimed_for_role(attrs['email'], attrs['role']):
            raise serializers.ValidationError(
                {'email': _('Email này đã được sử dụng cho một tài khoản khác.')}
            )
        return attrs


class RegisterEmailAvailabilitySerializer(serializers.Serializer):
    """Normalize the email before the debounced registration pre-check.

    ``role`` scopes the check to one portal: cùng email vẫn còn trống ở cổng khác
    (mô hình tách tài khoản theo cổng). Mặc định kiểm cho cổng ứng viên.
    """

    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=SELF_SERVICE_ROLES,
        required=False,
        default=User.Role.CANDIDATE,
    )

    def validate_email(self, value):
        return User.objects.normalize_email(value)


class PasswordResetRequestSerializer(serializers.Serializer):
    """Yêu cầu gửi link đặt lại mật khẩu. Không kiểm tra email có tồn tại hay
    không — view luôn trả cùng một thông điệp để tránh lộ danh sách email.

    ``portal`` chọn đúng tài khoản của cổng (một email có thể có tài khoản ứng
    viên và NTD riêng, mỗi bên mật khẩu riêng). Bỏ trống -> cổng ứng viên.
    """

    email = serializers.EmailField()
    captcha_token = serializers.CharField(write_only=True)
    portal = serializers.ChoiceField(choices=['main', 'employer'], required=False, write_only=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Đổi token trong link lấy mật khẩu mới. Token đã đủ vai trò xác thực nên
    không cần captcha ở bước này."""

    token = serializers.CharField(write_only=True)
    password = password_field()
    # Cổng admin không có endpoint quên mật khẩu công khai. Giá trị này chỉ có
    # trong link reset được một superuser gửi từ khu vực quản trị.
    portal = serializers.ChoiceField(
        choices=list(PORTAL_ROLE_BY_NAME), required=False, write_only=True
    )


class PasswordChangeSerializer(serializers.Serializer):
    """Đặt mật khẩu lần đầu cho OAuth hoặc đổi mật khẩu của phiên hiện tại.

    Tài khoản chưa có mật khẩu chứng minh chủ sở hữu bằng mã gửi qua email
    (``email_code``) thay cho mật khẩu hiện tại, trừ khi phiên hiện tại
    vừa đăng nhập Google.
    """

    current_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email_code = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = password_field()
    logout_all_sessions = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        user = self.context['request'].user
        if not user.has_usable_password():
            if not password_setup_code.is_required(user, self.context.get('session')):
                return attrs
            code = (attrs.get('email_code') or '').strip()
            if not code:
                raise serializers.ValidationError(
                    {'email_code': _('Nhập mã xác minh gửi tới email.')}
                )
            if not password_setup_code.verify_code(user, code):
                raise serializers.ValidationError(
                    {'email_code': _('Mã xác minh không đúng hoặc đã hết hạn.')}
                )
        else:
            current_password = attrs.get('current_password') or ''
            if not current_password:
                raise serializers.ValidationError(
                    {'current_password': _('Nhập mật khẩu hiện tại.')}
                )
            if not user.check_password(current_password):
                raise serializers.ValidationError(
                    {'current_password': _('Mật khẩu hiện tại không đúng.')}
                )
        return attrs


class LoginCredentialsSerializer(TokenObtainSerializer):
    """Xác thực email/mật khẩu mà chưa phát JWT.

    Tách bước này khỏi ``TokenObtainPairSerializer`` để view tự phát token qua
    ``issue_tokens`` (gắn ``AuthSession`` và refresh cookie HttpOnly).

    Mô hình tách tài khoản theo cổng: cùng email có thể có tài khoản ứng viên và
    NTD riêng (mật khẩu riêng), nên phải resolve theo **(email, role của cổng)**
    thay vì `authenticate()` mặc định (natural key nhập nhằng khi email trùng).
    """

    default_error_messages = {
        **TokenObtainSerializer.default_error_messages,
        'no_active_account': gettext_lazy('Email hoặc mật khẩu không đúng. Vui lòng thử lại.'),
    }

    captcha_token = serializers.CharField(write_only=True)
    # Bỏ trống -> cổng ứng viên (mặc định). FE luôn gửi 'main'/'employer'/'admin'.
    portal = serializers.ChoiceField(
        choices=list(PORTAL_ROLE_BY_NAME), required=False, write_only=True
    )

    def validate(self, attrs):
        attrs.pop('captcha_token', None)
        self.portal = attrs.pop('portal', None) or 'main'
        role = PORTAL_ROLE_BY_NAME[self.portal]

        email = User.objects.normalize_email(attrs.get(self.username_field) or '')
        password = attrs.get('password') or ''
        login_guard.ensure_not_throttled(email, self.portal)

        user = User.objects.filter(email__iexact=email, role=role).first()
        if user is None:
            # Băm một lần cho tài khoản không tồn tại, đúng như
            # ``ModelBackend.authenticate``: bỏ qua bước này thì thời gian phản
            # hồi tự nó tiết lộ email nào đã có tài khoản ở cổng này.
            User().set_password(password)

        if user is None or not user.check_password(password) or not is_account_accessible(user):
            login_guard.register_failure(email, self.portal)
            raise AuthenticationFailed(
                self.error_messages['no_active_account'], 'no_active_account'
            )

        login_guard.clear(email, self.portal)
        self.user = user
        return {}


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT claims dùng chung cho mọi luồng phát token thành công."""

    @classmethod
    def get_token(cls, user):
        from ...services.tokens import build_refresh_token

        return build_refresh_token(user)

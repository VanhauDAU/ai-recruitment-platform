from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ObjectDoesNotExist
from django.core.validators import RegexValidator
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenObtainSerializer

from common.media_storage import media_url_from_value

from .models import User
from .services.access import is_account_accessible


# Role của tài khoản tương ứng mỗi cổng — dùng để resolve đúng tài khoản khi
# đăng nhập/đăng ký/quên mật khẩu (một email có thể có nhiều tài khoản khác cổng).
PORTAL_ROLE_BY_NAME = {
    'main': User.Role.CANDIDATE,
    'employer': User.Role.EMPLOYER,
    'admin': User.Role.ADMIN,
}


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
        fields = ['email', 'password', 'role', 'full_name', 'captcha_token']
        extra_kwargs = {'full_name': {'required': False}}

    def validate_email(self, value):
        # Chỉ chuẩn hoá; tính duy nhất kiểm ở `validate()` vì phụ thuộc cả `role`.
        return User.objects.normalize_email(value)

    def validate(self, attrs):
        """Chặn trùng theo (email, role): cùng email vẫn đăng ký được ở cổng khác.

        Mô hình tách cổng — một email có thể có tài khoản ứng viên và NTD riêng.
        """
        if User.objects.filter(email__iexact=attrs['email'], role=attrs['role']).exists():
            raise serializers.ValidationError(
                {'email': 'Email này đã được sử dụng cho một tài khoản cùng loại.'}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop('captcha_token', None)
        return User.objects.create_user(**validated_data)


class RegisterEmailAvailabilitySerializer(serializers.Serializer):
    """Normalize the email before the debounced registration pre-check.

    ``role`` scopes the check to one portal: cùng email vẫn còn trống ở cổng khác
    (mô hình tách tài khoản theo cổng). Mặc định kiểm cho cổng ứng viên.
    """

    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=[User.Role.CANDIDATE, User.Role.EMPLOYER],
        required=False,
        default=User.Role.CANDIDATE,
    )

    def validate_email(self, value):
        return User.objects.normalize_email(value)


class SessionUserSerializer(serializers.ModelSerializer):
    """Authenticated-session DTO containing only fields rendered by the portals.

    Mỗi tài khoản đơn-vai (mô hình tách cổng): `role` là vai của chính tài khoản.
    """

    avatar_url = serializers.SerializerMethodField()
    job_preferences_configured = serializers.SerializerMethodField()
    employer_onboarding_required = serializers.SerializerMethodField()
    employer_onboarding_step = serializers.SerializerMethodField()
    employer_verification_completed = serializers.SerializerMethodField()
    has_usable_password = serializers.SerializerMethodField()
    two_factor_email_enabled = serializers.SerializerMethodField()
    two_factor_totp_enabled = serializers.SerializerMethodField()
    two_factor_backup_codes_enabled = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'public_id', 'email', 'role', 'full_name', 'phone', 'avatar_url',
            'email_verified', 'two_factor_enabled', 'two_factor_email_enabled',
            'two_factor_totp_enabled', 'two_factor_backup_codes_enabled', 'job_preferences_configured',
            'has_usable_password',
            'employer_onboarding_required',
            'employer_onboarding_step',
            'employer_verification_completed',
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj):
        return media_url_from_value(obj.avatar_url, request=self.context.get('request'))

    def get_job_preferences_configured(self, obj):
        if not obj.is_candidate:
            return False
        try:
            return obj.candidate_profile.job_preferences_configured
        except ObjectDoesNotExist:
            # Tolerate a legacy candidate created before its profile signal was
            # introduced; the candidate endpoint will create the profile once.
            return False

    def get_has_usable_password(self, obj):
        return obj.has_usable_password()

    def get_two_factor_email_enabled(self, obj):
        from .services.two_factor import enabled_methods
        return enabled_methods(obj)['email']

    def get_two_factor_totp_enabled(self, obj):
        return bool(obj.two_factor_totp_secret)

    def get_two_factor_backup_codes_enabled(self, obj):
        return bool(obj.two_factor_backup_code_hashes)

    def get_employer_onboarding_required(self, obj):
        return self.get_employer_onboarding_step(obj) != 'complete' if obj.is_employer else False

    def get_employer_onboarding_step(self, obj):
        if not obj.is_employer:
            return None
        try:
            recruiter = obj.recruiter_profile
        except ObjectDoesNotExist:
            return 'registration'
        if recruiter.registration_completed_at is None:
            return 'registration'
        if not obj.email_verified:
            return 'email_verification'
        try:
            recruiter.recruitment_need
        except ObjectDoesNotExist:
            return 'consulting_need'
        return 'complete'

    def get_employer_verification_completed(self, obj):
        if not obj.is_employer:
            return False
        try:
            recruiter = obj.recruiter_profile
        except ObjectDoesNotExist:
            return False
        # Local import keeps the accounts model layer independent while this
        # session DTO exposes the employer read-model needed for routing.
        from apps.employers.selectors import build_employer_onboarding_steps

        return build_employer_onboarding_steps(recruiter)['verification_completed']


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Cập nhật thông tin cá nhân ứng viên: chỉ họ tên và số điện thoại.

    Email KHÔNG đổi ở đây (đổi email đi qua luồng xác thực riêng
    `ChangeEmailSerializer`). Họ tên và SĐT sửa được nhiều lần.
    """

    full_name = serializers.CharField(
        max_length=255, trim_whitespace=True,
        error_messages={'blank': 'Vui lòng nhập họ và tên.', 'required': 'Vui lòng nhập họ và tên.'},
    )
    phone = serializers.CharField(
        max_length=20, required=False, allow_blank=True, trim_whitespace=True,
        validators=[RegexValidator(
            regex=r'^(0|\+84)\d{9,10}$',
            message='Số điện thoại không hợp lệ (VD: 0912345678 hoặc +84912345678).',
        )],
    )

    class Meta:
        model = User
        fields = ['full_name', 'phone']

    def validate_full_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError('Họ và tên cần ít nhất 2 ký tự.')
        return value.strip()


class ChangeEmailSerializer(serializers.Serializer):
    """Đổi email khi tài khoản chưa xác thực (reset email_verified và gửi lại link).

    Yêu cầu mật khẩu hiện tại (re-auth): chỉ chủ tài khoản mới đổi được email —
    chống kẻ chiếm access token đổi email để cướp tài khoản qua luồng quên mật khẩu.
    """

    current_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField()

    def validate(self, attrs):
        user = self.context['request'].user
        if user.has_usable_password():
            if not user.check_password(attrs.get('current_password') or ''):
                raise serializers.ValidationError({'current_password': 'Mật khẩu hiện tại không đúng.'})
        else:
            from .services import auth_sessions

            request = self.context['request']
            sid = request.auth.get(auth_sessions.SID_CLAIM) if request.auth else None
            session = auth_sessions.active_sessions(user).filter(id=sid).first()
            if not auth_sessions.is_recent_oauth_reauthentication(session):
                raise serializers.ValidationError({
                    'detail': 'Hãy đăng nhập lại với OAuth trước khi đổi email.',
                    'code': 'reauth_required',
                })
        return attrs

    def validate_email(self, value):
        value = User.objects.normalize_email(value)
        user = self.context['request'].user
        if value.lower() == user.email.lower():
            raise serializers.ValidationError('Email mới trùng với email hiện tại.')
        # Trùng chỉ tính trong cùng role (mô hình tách tài khoản theo cổng).
        if User.objects.filter(email__iexact=value, role=user.role).exclude(pk=user.pk).exists():
            raise serializers.ValidationError('Email này đã được sử dụng cho một tài khoản cùng loại.')
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Yêu cầu gửi link đặt lại mật khẩu. Không kiểm tra email có tồn tại hay
    không — view luôn trả cùng một thông điệp để tránh lộ danh sách email.

    ``portal`` chọn đúng tài khoản của cổng (một email có thể có tài khoản ứng
    viên và NTD riêng, mỗi bên mật khẩu riêng). Bỏ trống -> cổng ứng viên.
    """

    email = serializers.EmailField()
    captcha_token = serializers.CharField(write_only=True)
    portal = serializers.ChoiceField(
        choices=['main', 'employer'], required=False, write_only=True
    )


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Đổi token trong link lấy mật khẩu mới. Token đã đủ vai trò xác thực nên
    không cần captcha ở bước này."""

    token = serializers.CharField(write_only=True)
    password = password_field()


class PasswordChangeSerializer(serializers.Serializer):
    """Đặt mật khẩu lần đầu cho OAuth hoặc đổi mật khẩu của phiên hiện tại."""

    current_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = password_field()
    logout_all_sessions = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        user = self.context['request'].user
        if user.has_usable_password():
            current_password = attrs.get('current_password') or ''
            if not current_password:
                raise serializers.ValidationError({'current_password': 'Nhập mật khẩu hiện tại.'})
            if not user.check_password(current_password):
                raise serializers.ValidationError({'current_password': 'Mật khẩu hiện tại không đúng.'})
        return attrs


class LoginCredentialsSerializer(TokenObtainSerializer):
    """Xác thực email/mật khẩu mà chưa phát JWT.

    Tách bước này khỏi ``TokenObtainPairSerializer`` để tài khoản bật 2FA không
    nhận refresh token trước khi mã email được xác nhận.

    Mô hình tách tài khoản theo cổng: cùng email có thể có tài khoản ứng viên và
    NTD riêng (mật khẩu riêng), nên phải resolve theo **(email, role của cổng)**
    thay vì `authenticate()` mặc định (natural key nhập nhằng khi email trùng).
    """

    default_error_messages = {
        **TokenObtainSerializer.default_error_messages,
        'no_active_account': 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
    }

    captcha_token = serializers.CharField(write_only=True)
    # Bỏ trống -> cổng ứng viên (mặc định). FE luôn gửi 'main'/'employer'/'admin'.
    portal = serializers.ChoiceField(choices=list(PORTAL_ROLE_BY_NAME), required=False, write_only=True)

    def validate(self, attrs):
        attrs.pop('captcha_token', None)
        self.portal = attrs.pop('portal', None) or 'main'
        role = PORTAL_ROLE_BY_NAME[self.portal]

        email = User.objects.normalize_email(attrs.get(self.username_field) or '')
        user = User.objects.filter(email__iexact=email, role=role).first()
        if (
            user is None
            or not user.check_password(attrs.get('password') or '')
            or not is_account_accessible(user)
        ):
            raise AuthenticationFailed(self.error_messages['no_active_account'], 'no_active_account')

        self.user = user
        return {}


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT claims dùng chung cho mọi luồng phát token thành công."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['email'] = user.email
        return token

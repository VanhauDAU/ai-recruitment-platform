"""The signed-in user's own session payload, profile edits and email change."""

from django.core.exceptions import ObjectDoesNotExist
from django.core.validators import RegexValidator
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework import serializers

from common.storage.media import media_url_from_value

from ...models import User
from .auth import admin_access_payload


class SessionUserSerializer(serializers.ModelSerializer):
    """Authenticated-session DTO containing only fields rendered by the portals.

    Mỗi tài khoản đơn-vai (mô hình tách cổng): `role` là vai của chính tài khoản.
    """

    avatar_url = serializers.SerializerMethodField()
    job_preferences_configured = serializers.SerializerMethodField()
    employer_onboarding_required = serializers.SerializerMethodField()
    employer_onboarding_step = serializers.SerializerMethodField()
    employer_verification_completed = serializers.SerializerMethodField()
    employer_job_workspace_ready = serializers.SerializerMethodField()
    has_usable_password = serializers.SerializerMethodField()
    admin_access = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'public_id',
            'email',
            'role',
            'full_name',
            'phone',
            'avatar_url',
            'email_verified',
            'preferred_language',
            'job_preferences_configured',
            'has_usable_password',
            'employer_onboarding_required',
            'employer_onboarding_step',
            'employer_verification_completed',
            'employer_job_workspace_ready',
            'admin_access',
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj) -> str:
        return media_url_from_value(obj.avatar_url, request=self.context.get('request'))

    def get_job_preferences_configured(self, obj) -> bool:
        if not obj.is_candidate:
            return False
        try:
            return obj.candidate_profile.job_preferences_configured
        except ObjectDoesNotExist:
            # Tolerate a legacy candidate created before its profile signal was
            # introduced; the candidate endpoint will create the profile once.
            return False

    def get_has_usable_password(self, obj) -> bool:
        return obj.has_usable_password()

    def get_employer_onboarding_required(self, obj) -> bool:
        return self.get_employer_onboarding_step(obj) != 'complete' if obj.is_employer else False

    def _employer_profile(self, obj):
        cached = getattr(self, '_employer_profile_cache', None)
        if cached is None:
            cached = self._employer_profile_cache = {}
        if obj.pk not in cached:
            try:
                cached[obj.pk] = obj.recruiter_profile
            except ObjectDoesNotExist:
                cached[obj.pk] = None
        return cached[obj.pk]

    def _employer_onboarding(self, obj):
        cached = getattr(self, '_employer_onboarding_cache', None)
        if cached is None:
            cached = self._employer_onboarding_cache = {}
        if obj.pk not in cached:
            recruiter = self._employer_profile(obj)
            if recruiter is None:
                cached[obj.pk] = None
            else:
                from apps.employers.selectors import build_employer_onboarding_steps

                cached[obj.pk] = build_employer_onboarding_steps(recruiter)
        return cached[obj.pk]

    def _employer_readiness(self, obj):
        cached = getattr(self, '_employer_readiness_cache', None)
        if cached is None:
            cached = self._employer_readiness_cache = {}
        if obj.pk not in cached:
            recruiter = self._employer_profile(obj)
            if recruiter is None:
                cached[obj.pk] = None
            else:
                from apps.employers.selectors import build_employer_readiness

                cached[obj.pk] = build_employer_readiness(
                    recruiter,
                    onboarding=self._employer_onboarding(obj),
                )
        return cached[obj.pk]

    def get_employer_onboarding_step(self, obj) -> str | None:
        if not obj.is_employer:
            return None
        recruiter = self._employer_profile(obj)
        if recruiter is None:
            return 'registration'
        # Keep routing and the administrator read model on the same canonical
        # two-step definition.
        onboarding = self._employer_onboarding(obj)
        if not onboarding['registration_completed']:
            return 'registration'
        if not onboarding['email_verified']:
            return 'email_verification'
        return 'complete'

    def get_employer_verification_completed(self, obj) -> bool:
        if not obj.is_employer:
            return False
        if self._employer_profile(obj) is None:
            return False
        return self._employer_onboarding(obj)['verification_completed']

    def get_employer_job_workspace_ready(self, obj) -> bool:
        if not obj.is_employer:
            return False
        if self._employer_profile(obj) is None:
            return False
        return self._employer_readiness(obj)['job_workspace_ready']

    def get_admin_access(self, obj) -> dict | None:
        return admin_access_payload(obj)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Cập nhật thông tin cá nhân: họ tên, số điện thoại và ngôn ngữ giao diện.

    Email KHÔNG đổi ở đây (đổi email đi qua luồng xác thực riêng
    `ChangeEmailSerializer`). Họ tên và SĐT sửa được nhiều lần.
    """

    full_name = serializers.CharField(
        max_length=255,
        trim_whitespace=True,
        error_messages={
            'blank': gettext_lazy('Vui lòng nhập họ và tên.'),
            'required': gettext_lazy('Vui lòng nhập họ và tên.'),
        },
    )
    phone = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
        validators=[
            RegexValidator(
                regex=r'^(0|\+84)\d{9,10}$',
                message=gettext_lazy(
                    'Số điện thoại không hợp lệ (VD: 0912345678 hoặc +84912345678).'
                ),
            )
        ],
    )

    class Meta:
        model = User
        fields = ['full_name', 'phone', 'preferred_language']

    def validate_full_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError(_('Họ và tên cần ít nhất 2 ký tự.'))
        return value.strip()

    def validate_phone(self, value):
        user = self.context['request'].user
        if user.is_employer and value != user.phone:
            raise serializers.ValidationError(
                _('Nhà tuyển dụng phải đổi số điện thoại qua luồng xác thực SMS.')
            )
        return value


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
                raise serializers.ValidationError(
                    {'current_password': _('Mật khẩu hiện tại không đúng.')}
                )
        else:
            from ...services import auth_sessions

            request = self.context['request']
            sid = request.auth.get(auth_sessions.SID_CLAIM) if request.auth else None
            session = auth_sessions.active_sessions(user).filter(id=sid).first()
            if not auth_sessions.is_recent_oauth_reauthentication(session):
                raise serializers.ValidationError(
                    {
                        'detail': _('Hãy đăng nhập lại với OAuth trước khi đổi email.'),
                        'code': 'reauth_required',
                    }
                )
        return attrs

    def validate_email(self, value):
        value = User.objects.normalize_email(value)
        user = self.context['request'].user
        if value.lower() == user.email.lower():
            raise serializers.ValidationError(_('Email mới trùng với email hiện tại.'))
        # Trùng chỉ tính trong cùng role (mô hình tách tài khoản theo cổng), nhưng
        # phải tính cả email đã được một danh tính OAuth cùng cổng sở hữu.
        if User.objects.email_claimed_for_role(value, user.role, exclude_user_id=user.pk):
            raise serializers.ValidationError(
                _('Email này đã được sử dụng cho một tài khoản khác.')
            )
        return value

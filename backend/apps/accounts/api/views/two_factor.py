"""Thiết lập, quản lý và xác nhận đa phương thức MFA."""

from urllib.parse import quote

from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ...models import AuthEmailJob, User
from ...services import two_factor
from ...services.refresh_cookies import set_refresh_cookie
from ...services.tokens import issue_tokens
from ...tasks import queue_auth_email
from ..serializers import SessionUserSerializer


class TwoFactorCodeSerializer(serializers.Serializer):
    code = serializers.RegexField(
        r'^\d{6}$', error_messages={'invalid': 'Mã xác minh gồm 6 chữ số.'}
    )


class TwoFactorLoginCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=16)
    method = serializers.ChoiceField(
        choices=['email', 'totp', 'backup'], default='email', required=False
    )

    def validate(self, attrs):
        length = 8 if attrs['method'] == 'backup' else 6
        code = attrs['code']
        if not code.isdigit() or len(code) != length:
            raise serializers.ValidationError({'code': f'Mã xác minh gồm {length} chữ số.'})
        return attrs


class TwoFactorChallengeSerializer(TwoFactorLoginCodeSerializer):
    challenge = serializers.CharField(max_length=128)


class TwoFactorResendSerializer(serializers.Serializer):
    challenge = serializers.CharField(max_length=128)


class EmployerTwoFactorMethodSerializer(serializers.Serializer):
    target = serializers.ChoiceField(choices=['email', 'totp', 'backup'])


class EmployerTwoFactorMethodDisableSerializer(TwoFactorLoginCodeSerializer):
    target = serializers.ChoiceField(choices=['email', 'totp', 'backup'])


def _code_response(user, purpose):
    return {
        'detail': 'Mã xác minh đã được gửi tới email của bạn.',
        'email': user.email,
        'expires_in': two_factor.code_remaining(user, purpose),
    }


def _session_response(user, request, **extra):
    return {**SessionUserSerializer(user, context={'request': request}).data, **extra}


def _employer_only(request):
    return request.user.is_employer


def _available_disable_verification_methods(user, target):
    """Các phương thức đủ điều kiện step-up để tắt một phương thức MFA."""
    methods = two_factor.enabled_methods(user)
    # Không cho recovery code tự xóa chính bộ recovery code đó.
    if target == 'backup':
        methods['backup'] = False
    return methods


def _target_is_enabled(methods, target):
    return methods.get(target, False)


def _verify_method_for_disable(user, method, code):
    methods = two_factor.enabled_methods(user)
    return (
        (
            method == 'email'
            and methods['email']
            and two_factor.verify_code(user, two_factor.PURPOSE_DISABLE, code)
        )
        or (method == 'totp' and methods['totp'] and two_factor.verify_user_totp(user, code))
        or (method == 'backup' and methods['backup'] and two_factor.consume_backup_code(user, code))
    )


@extend_schema(
    summary='Gửi mã để bật xác minh hai bước',
    request=None,
    responses={
        200: inline_serializer(
            'TwoFactorCodeSent',
            {
                'detail': serializers.CharField(),
                'email': serializers.CharField(),
                'expires_in': serializers.IntegerField(),
            },
        )
    },
    tags=['auth'],
)
class TwoFactorSetupSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        user = request.user
        if two_factor.enabled_methods(user)['email']:
            return Response(
                {'detail': 'Xác minh hai bước đã được bật.'}, status=status.HTTP_400_BAD_REQUEST
            )
        two_factor.issue_code(user, two_factor.PURPOSE_SETUP)
        queue_auth_email(
            AuthEmailJob.Kind.TWO_FACTOR, user, context={'purpose': two_factor.PURPOSE_SETUP}
        )
        return Response(_code_response(user, two_factor.PURPOSE_SETUP))


@extend_schema(
    summary='Xác nhận mã để bật xác minh hai bước',
    request=TwoFactorCodeSerializer,
    responses={200: SessionUserSerializer},
    tags=['auth'],
)
class TwoFactorSetupConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor_verify'

    def post(self, request):
        serializer = TwoFactorCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not two_factor.verify_code(
            user, two_factor.PURPOSE_SETUP, serializer.validated_data['code']
        ):
            return Response(
                {'detail': 'Mã xác minh không đúng hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.two_factor_email_enabled = True
        two_factor.refresh_enabled_flag(user)
        user.save(update_fields=['two_factor_email_enabled', 'two_factor_enabled', 'updated_at'])
        extra = {}
        if user.is_employer:
            extra['backup_codes'] = two_factor.replace_backup_codes(user)
        return Response(_session_response(user, request, **extra))


class TwoFactorDisableSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        user = request.user
        if user.is_admin_role:
            return Response(
                {
                    'detail': 'MFA của tài khoản quản trị chỉ có thể thay đổi qua quy trình quản trị an toàn.'
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        if not two_factor.enabled_methods(user)['email']:
            return Response(
                {'detail': 'Xác minh hai bước chưa được bật.'}, status=status.HTTP_400_BAD_REQUEST
            )
        two_factor.issue_code(user, two_factor.PURPOSE_DISABLE)
        queue_auth_email(
            AuthEmailJob.Kind.TWO_FACTOR,
            user,
            context={'purpose': two_factor.PURPOSE_DISABLE, 'target': 'email'},
        )
        return Response(_code_response(user, two_factor.PURPOSE_DISABLE))


class TwoFactorDisableConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor_verify'

    def post(self, request):
        serializer = TwoFactorCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if user.is_admin_role:
            return Response(
                {'detail': 'Không thể tắt MFA cho tài khoản quản trị.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not two_factor.enabled_methods(user)['email'] or not two_factor.verify_code(
            user, two_factor.PURPOSE_DISABLE, serializer.validated_data['code']
        ):
            return Response(
                {'detail': 'Mã xác minh không đúng hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.two_factor_email_enabled = False
        # Loại bỏ fallback cho account legacy trước khi tính lại từ các method.
        user.two_factor_enabled = False
        methods = two_factor.refresh_enabled_flag(user)
        # Mã dự phòng chỉ có ý nghĩa khi còn ít nhất một phương thức MFA chính.
        if not (methods['email'] or methods['totp']):
            user.two_factor_backup_code_hashes = []
        user.save(
            update_fields=[
                'two_factor_email_enabled',
                'two_factor_backup_code_hashes',
                'two_factor_enabled',
                'updated_at',
            ]
        )
        return Response(_session_response(user, request))


class EmployerTwoFactorMethodsView(APIView):
    """Status không chứa secret/hash và chỉ dùng cho workspace employer."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _employer_only(request):
            return Response(
                {'detail': 'Chức năng này chỉ dành cho nhà tuyển dụng.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        methods = two_factor.enabled_methods(request.user)
        return Response(
            {
                **methods,
                'two_factor_enabled': request.user.two_factor_enabled,
                'backup_codes_remaining': len(request.user.two_factor_backup_code_hashes or []),
            }
        )


class EmployerTotpSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        if not _employer_only(request):
            return Response(
                {'detail': 'Chức năng này chỉ dành cho nhà tuyển dụng.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        secret = two_factor.start_totp_setup(request.user)
        issuer = quote('ProCV Nhà tuyển dụng')
        label = quote(f'ProCV Nhà tuyển dụng:{request.user.email}')
        return Response(
            {
                'manual_key': secret,
                'otpauth_url': f'otpauth://totp/{label}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30',
                'expires_in': settings.TWO_FACTOR_CODE_TTL,
            }
        )


class EmployerTotpConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor_verify'

    def post(self, request):
        if not _employer_only(request):
            return Response(
                {'detail': 'Chức năng này chỉ dành cho nhà tuyển dụng.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = TwoFactorCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        secret = two_factor.pending_totp_secret(request.user)
        if not two_factor.verify_totp_secret(secret, serializer.validated_data['code']):
            return Response(
                {'detail': 'Mã từ ứng dụng xác thực không đúng hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.two_factor_totp_secret = two_factor.encrypt_totp_secret(secret)
        two_factor.refresh_enabled_flag(request.user)
        request.user.save(
            update_fields=['two_factor_totp_secret', 'two_factor_enabled', 'updated_at']
        )
        two_factor.discard_pending_totp_secret(request.user)
        return Response(_session_response(request.user, request))


class EmployerTotpDisableView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor_verify'

    def post(self, request):
        if not _employer_only(request):
            return Response(
                {'detail': 'Chức năng này chỉ dành cho nhà tuyển dụng.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = TwoFactorCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not two_factor.verify_user_totp(request.user, serializer.validated_data['code']):
            return Response(
                {'detail': 'Mã từ ứng dụng xác thực không đúng.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.two_factor_totp_secret = ''
        # Không để cờ legacy tổng hợp bị suy ra thành email MFA khi TOTP vừa tắt.
        request.user.two_factor_enabled = False
        methods = two_factor.refresh_enabled_flag(request.user)
        if not (methods['email'] or methods['totp']):
            request.user.two_factor_backup_code_hashes = []
        request.user.save(
            update_fields=[
                'two_factor_totp_secret',
                'two_factor_backup_code_hashes',
                'two_factor_enabled',
                'updated_at',
            ]
        )
        return Response(_session_response(request.user, request))


class EmployerTwoFactorMethodDisableSendView(APIView):
    """Gửi email step-up để tắt một phương thức MFA của employer."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        if not _employer_only(request):
            return Response(
                {'detail': 'Chức năng này chỉ dành cho nhà tuyển dụng.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = EmployerTwoFactorMethodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        methods = two_factor.enabled_methods(request.user)
        target = serializer.validated_data['target']
        if not _target_is_enabled(methods, target):
            return Response(
                {'detail': 'Phương thức xác thực này chưa được bật.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _available_disable_verification_methods(request.user, target)['email']:
            return Response(
                {'detail': 'Xác thực email hiện không khả dụng.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        two_factor.issue_code(request.user, two_factor.PURPOSE_DISABLE)
        queue_auth_email(
            AuthEmailJob.Kind.TWO_FACTOR,
            request.user,
            context={'purpose': two_factor.PURPOSE_DISABLE, 'target': target},
        )
        return Response(_code_response(request.user, two_factor.PURPOSE_DISABLE))


class EmployerTwoFactorMethodDisableView(APIView):
    """Tắt email, TOTP hoặc recovery codes sau step-up bằng phương thức đang bật."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor_verify'

    def post(self, request):
        if not _employer_only(request):
            return Response(
                {'detail': 'Chức năng này chỉ dành cho nhà tuyển dụng.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = EmployerTwoFactorMethodDisableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = serializer.validated_data['target']
        method = serializer.validated_data['method']
        methods = two_factor.enabled_methods(request.user)
        available_methods = _available_disable_verification_methods(request.user, target)
        if not _target_is_enabled(methods, target) or not available_methods.get(method, False):
            return Response(
                {'detail': 'Phương thức xác minh đã chọn không khả dụng.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not _verify_method_for_disable(request.user, method, serializer.validated_data['code']):
            return Response(
                {'detail': 'Mã xác minh không đúng hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if target == 'email':
            request.user.two_factor_email_enabled = False
        elif target == 'totp':
            request.user.two_factor_totp_secret = ''
        else:
            request.user.two_factor_backup_code_hashes = []
        # Reset compatibility flag before recalculating, so a disabled TOTP is
        # not interpreted as legacy email MFA.
        request.user.two_factor_enabled = False
        remaining_methods = two_factor.refresh_enabled_flag(request.user)
        if not (remaining_methods['email'] or remaining_methods['totp']):
            request.user.two_factor_backup_code_hashes = []
        request.user.save(
            update_fields=[
                'two_factor_email_enabled',
                'two_factor_totp_secret',
                'two_factor_backup_code_hashes',
                'two_factor_enabled',
                'updated_at',
            ]
        )
        return Response(_session_response(request.user, request))


class EmployerBackupCodesGenerateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor_verify'

    def post(self, request):
        if not _employer_only(request):
            return Response(
                {'detail': 'Chức năng này chỉ dành cho nhà tuyển dụng.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = TwoFactorLoginCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        methods = two_factor.enabled_methods(request.user)
        method = serializer.validated_data['method']
        valid = (
            (
                method == 'email'
                and methods['email']
                and two_factor.verify_code(
                    request.user, two_factor.PURPOSE_BACKUP, serializer.validated_data['code']
                )
            )
            or (
                method == 'totp'
                and methods['totp']
                and two_factor.verify_user_totp(request.user, serializer.validated_data['code'])
            )
            or (
                method == 'backup'
                and methods['backup']
                and two_factor.consume_backup_code(request.user, serializer.validated_data['code'])
            )
        )
        if not valid:
            return Response(
                {'detail': 'Mã xác minh không đúng hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        backup_codes = two_factor.replace_backup_codes(request.user)
        return Response(_session_response(request.user, request, backup_codes=backup_codes))


class EmployerBackupCodesSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        if not _employer_only(request):
            return Response(
                {'detail': 'Chức năng này chỉ dành cho nhà tuyển dụng.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not two_factor.enabled_methods(request.user)['email']:
            return Response(
                {'detail': 'Hãy bật xác thực email trước khi tạo mã dự phòng.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        two_factor.issue_code(request.user, two_factor.PURPOSE_BACKUP)
        queue_auth_email(
            AuthEmailJob.Kind.TWO_FACTOR,
            request.user,
            context={'purpose': two_factor.PURPOSE_BACKUP},
        )
        return Response(_code_response(request.user, two_factor.PURPOSE_BACKUP))


def _challenge_user(challenge):
    data = two_factor.get_login_challenge(challenge)
    if not data:
        return None, None
    user = User.objects.filter(
        pk=data['user_id'], is_deleted=False, status=User.Status.ACTIVE
    ).first()
    return user, data


@extend_schema(
    summary='Gửi lại mã xác minh đăng nhập hai bước',
    request=TwoFactorResendSerializer,
    responses={
        200: inline_serializer(
            'TwoFactorLoginResend',
            {
                'detail': serializers.CharField(),
                'email': serializers.CharField(),
                'expires_in': serializers.IntegerField(),
            },
        )
    },
    tags=['auth'],
)
class TwoFactorLoginResendView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        serializer = TwoFactorResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, _ = _challenge_user(serializer.validated_data['challenge'])
        if user is None:
            return Response(
                {'detail': 'Phiên xác minh không hợp lệ hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not two_factor.enabled_methods(user)['email']:
            return Response(
                {'detail': 'Tài khoản này không dùng xác thực email.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        two_factor.issue_code(user, two_factor.PURPOSE_LOGIN)
        queue_auth_email(
            AuthEmailJob.Kind.TWO_FACTOR, user, context={'purpose': two_factor.PURPOSE_LOGIN}
        )
        return Response(_code_response(user, two_factor.PURPOSE_LOGIN))


@extend_schema(
    summary='Xác nhận mã và hoàn tất đăng nhập hai bước',
    request=TwoFactorChallengeSerializer,
    responses={
        200: inline_serializer(
            'TwoFactorLoginTokens',
            {
                'access': serializers.CharField(),
            },
        )
    },
    tags=['auth'],
)
class TwoFactorLoginVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor_verify'

    def post(self, request):
        serializer = TwoFactorChallengeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        challenge = serializer.validated_data['challenge']
        user, _ = _challenge_user(challenge)
        if user is None:
            return Response(
                {'detail': 'Mã xác minh không đúng hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        methods = two_factor.enabled_methods(user)
        method = serializer.validated_data['method']
        code = serializer.validated_data['code']
        valid = (
            (
                method == 'email'
                and methods['email']
                and two_factor.verify_code(user, two_factor.PURPOSE_LOGIN, code)
            )
            or (method == 'totp' and methods['totp'] and two_factor.verify_user_totp(user, code))
            or (
                method == 'backup'
                and methods['backup']
                and two_factor.consume_backup_code(user, code)
            )
        )
        if not valid:
            return Response(
                {'detail': 'Mã xác minh không đúng hoặc đã hết hạn.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        two_factor.consume_login_challenge(challenge)
        tokens = issue_tokens(user, request, auth_method='mfa')
        response = Response({'access': tokens['access']})
        return set_refresh_cookie(response, tokens['refresh'], user=user)

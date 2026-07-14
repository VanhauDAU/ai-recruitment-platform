"""Thiết lập và xác nhận mã email cho xác minh hai bước."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..models import AuthEmailJob, User
from ..serializers import SessionUserSerializer
from ..services import two_factor
from ..services.tokens import issue_tokens
from ..tasks import queue_auth_email


class TwoFactorCodeSerializer(serializers.Serializer):
    code = serializers.RegexField(r'^\d{6}$', error_messages={'invalid': 'Mã xác minh gồm 6 chữ số.'})


class TwoFactorChallengeSerializer(TwoFactorCodeSerializer):
    challenge = serializers.CharField(max_length=128)


class TwoFactorResendSerializer(serializers.Serializer):
    challenge = serializers.CharField(max_length=128)


def _code_response(user, purpose):
    return {
        'detail': 'Mã xác minh đã được gửi tới email của bạn.',
        'email': user.email,
        'expires_in': two_factor.code_remaining(user, purpose),
    }


@extend_schema(
    summary='Gửi mã để bật xác minh hai bước',
    request=None,
    responses={200: inline_serializer('TwoFactorCodeSent', {
        'detail': serializers.CharField(), 'email': serializers.CharField(), 'expires_in': serializers.IntegerField(),
    })},
    tags=['auth'],
)
class TwoFactorSetupSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        user = request.user
        if user.two_factor_enabled:
            return Response({'detail': 'Xác minh hai bước đã được bật.'}, status=status.HTTP_400_BAD_REQUEST)
        two_factor.issue_code(user, two_factor.PURPOSE_SETUP)
        queue_auth_email(AuthEmailJob.Kind.TWO_FACTOR, user, context={'purpose': two_factor.PURPOSE_SETUP})
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
        if not two_factor.verify_code(user, two_factor.PURPOSE_SETUP, serializer.validated_data['code']):
            return Response({'detail': 'Mã xác minh không đúng hoặc đã hết hạn.'}, status=status.HTTP_400_BAD_REQUEST)
        user.two_factor_enabled = True
        user.save(update_fields=['two_factor_enabled', 'updated_at'])
        return Response(SessionUserSerializer(user, context={'request': request}).data)


class TwoFactorDisableSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor'

    def post(self, request):
        user = request.user
        if not user.two_factor_enabled:
            return Response({'detail': 'Xác minh hai bước chưa được bật.'}, status=status.HTTP_400_BAD_REQUEST)
        two_factor.issue_code(user, two_factor.PURPOSE_DISABLE)
        queue_auth_email(AuthEmailJob.Kind.TWO_FACTOR, user, context={'purpose': two_factor.PURPOSE_DISABLE})
        return Response(_code_response(user, two_factor.PURPOSE_DISABLE))


class TwoFactorDisableConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'two_factor_verify'

    def post(self, request):
        serializer = TwoFactorCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.two_factor_enabled or not two_factor.verify_code(user, two_factor.PURPOSE_DISABLE, serializer.validated_data['code']):
            return Response({'detail': 'Mã xác minh không đúng hoặc đã hết hạn.'}, status=status.HTTP_400_BAD_REQUEST)
        user.two_factor_enabled = False
        user.save(update_fields=['two_factor_enabled', 'updated_at'])
        return Response(SessionUserSerializer(user, context={'request': request}).data)


def _challenge_user(challenge):
    data = two_factor.get_login_challenge(challenge)
    if not data:
        return None, None
    user = User.objects.filter(pk=data['user_id'], is_deleted=False, status=User.Status.ACTIVE).first()
    return user, data


@extend_schema(
    summary='Gửi lại mã xác minh đăng nhập hai bước',
    request=TwoFactorResendSerializer,
    responses={200: inline_serializer('TwoFactorLoginResend', {
        'detail': serializers.CharField(), 'email': serializers.CharField(), 'expires_in': serializers.IntegerField(),
    })},
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
            return Response({'detail': 'Phiên xác minh không hợp lệ hoặc đã hết hạn.'}, status=status.HTTP_400_BAD_REQUEST)
        two_factor.issue_code(user, two_factor.PURPOSE_LOGIN)
        queue_auth_email(AuthEmailJob.Kind.TWO_FACTOR, user, context={'purpose': two_factor.PURPOSE_LOGIN})
        return Response(_code_response(user, two_factor.PURPOSE_LOGIN))


@extend_schema(
    summary='Xác nhận mã và hoàn tất đăng nhập hai bước',
    request=TwoFactorChallengeSerializer,
    responses={200: inline_serializer('TwoFactorLoginTokens', {
        'access': serializers.CharField(), 'refresh': serializers.CharField(),
    })},
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
        if user is None or not two_factor.verify_code(user, two_factor.PURPOSE_LOGIN, serializer.validated_data['code']):
            return Response({'detail': 'Mã xác minh không đúng hoặc đã hết hạn.'}, status=status.HTTP_400_BAD_REQUEST)
        two_factor.consume_login_challenge(challenge)
        return Response(issue_tokens(user))

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from common.client_ip import client_ip
from common.throttling import ClientIPScopedRateThrottle

from ...models import (
    RecruiterProfile,
)
from ...selectors import has_explicit_company_link
from ...services import (
    DpaPolicyChanged,
    DpaPolicyUnavailable,
    PhoneChallengeError,
    accept_recruiter_dpa,
    get_or_create_recruiter,
    get_sms_phone_challenge,
    normalize_vietnamese_mobile,
    phone_challenge_snapshot,
    start_sms_phone_verification,
    verify_sms_phone_challenge,
)
from ..exceptions import (
    DpaPolicyChangedResponse,
    DpaPolicyUnavailableResponse,
    PhoneChallengeResponse,
)
from ..serializers import (
    EmployerDpaAcceptanceSerializer,
    RecruiterProfileSerializer,
)


def _require_company(user):
    recruiter = get_or_create_recruiter(user)
    if not has_explicit_company_link(recruiter):
        raise NotFound('Bạn chưa liên kết với công ty nào.')
    return recruiter


def _require_owner(user):
    recruiter = _require_company(user)
    if recruiter.company_role != RecruiterProfile.CompanyRole.OWNER:
        raise ValidationError(
            {'detail': 'Chỉ người tạo hồ sơ công ty được thực hiện thao tác này.'}
        )
    return recruiter


class RecruiterMeView(generics.RetrieveUpdateAPIView):
    """Hồ sơ nhà tuyển dụng của tôi + trạng thái onboarding 5 bước."""

    serializer_class = RecruiterProfileSerializer
    permission_classes = [IsEmployer]

    def get_object(self):
        return get_or_create_recruiter(self.request.user)


class PhoneAvailabilityView(APIView):
    """Compatibility endpoint that validates format without exposing account use."""

    permission_classes = [IsEmployer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'employer_phone_status'

    @extend_schema(
        summary='Kiểm tra định dạng số điện thoại nhà tuyển dụng',
        parameters=[OpenApiParameter('phone', str, OpenApiParameter.QUERY, required=True)],
        responses=inline_serializer(
            'PhoneAvailability',
            fields={
                'available': serializers.BooleanField(),
                'detail': serializers.CharField(required=False),
            },
        ),
        tags=['employer'],
    )
    def get(self, request):
        phone = (request.query_params.get('phone') or '').strip()
        if not phone:
            raise ValidationError({'phone': 'Nhập số điện thoại cần kiểm tra.'})
        try:
            normalize_vietnamese_mobile(phone)
        except DjangoValidationError as error:
            raise ValidationError({'phone': error.message}) from error
        return Response({'available': True})


class SendPhoneOtpView(APIView):
    permission_classes = [IsEmployer]
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'employer_phone_send'

    @extend_schema(
        summary='Tạo challenge và gửi mã OTP xác thực qua SMS',
        request=inline_serializer(
            'SendPhoneOtp',
            fields={
                'phone': serializers.CharField(required=False),
                'password': serializers.CharField(),
            },
        ),
        responses={
            202: inline_serializer(
                'EmployerPhoneChallenge',
                fields={
                    'public_id': serializers.CharField(),
                    'purpose': serializers.CharField(),
                    'status': serializers.CharField(),
                    'failure_code': serializers.CharField(),
                    'expires_at': serializers.DateTimeField(),
                    'attempts_remaining': serializers.IntegerField(),
                    'can_verify': serializers.BooleanField(),
                    'can_retry': serializers.BooleanField(),
                },
            )
        },
        tags=['employer'],
    )
    def post(self, request):
        phone = (request.data.get('phone') or request.user.phone or '').strip()
        if not phone:
            raise ValidationError({'phone': 'Nhập số điện thoại cần xác thực.'})
        try:
            challenge = start_sms_phone_verification(
                user=request.user,
                phone=phone,
                password=request.data.get('password'),
            )
        except (PhoneChallengeError, DjangoValidationError) as error:
            if isinstance(error, PhoneChallengeError):
                raise PhoneChallengeResponse(error) from error
            raise ValidationError({'phone': error.message}) from error
        return Response(phone_challenge_snapshot(challenge), status=status.HTTP_202_ACCEPTED)


class PhoneChallengeView(APIView):
    permission_classes = [IsEmployer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'employer_phone_status'

    @extend_schema(
        summary='Đọc trạng thái challenge SMS của chính nhà tuyển dụng',
        responses=inline_serializer(
            'EmployerPhoneChallengeStatus',
            fields={
                'public_id': serializers.CharField(),
                'purpose': serializers.CharField(),
                'status': serializers.CharField(),
                'failure_code': serializers.CharField(),
                'expires_at': serializers.DateTimeField(),
                'attempts_remaining': serializers.IntegerField(),
                'can_verify': serializers.BooleanField(),
                'can_retry': serializers.BooleanField(),
            },
        ),
        tags=['employer'],
    )
    def get(self, request, public_id):
        try:
            challenge = get_sms_phone_challenge(user=request.user, public_id=public_id)
        except PhoneChallengeError as error:
            raise PhoneChallengeResponse(error) from error
        return Response(phone_challenge_snapshot(challenge))


class VerifyPhoneOtpView(APIView):
    permission_classes = [IsEmployer]
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'employer_phone_verify'

    @extend_schema(
        summary='Xác thực mã OTP số điện thoại',
        request=inline_serializer(
            'VerifyPhoneOtp',
            fields={
                'challenge_id': serializers.CharField(),
                'code': serializers.CharField(),
            },
        ),
        responses={200: RecruiterProfileSerializer},
        tags=['employer'],
    )
    def post(self, request):
        challenge_id = (request.data.get('challenge_id') or '').strip()
        code = (request.data.get('code') or '').strip()
        if not challenge_id:
            raise ValidationError({'challenge_id': 'Thiếu yêu cầu xác thực.'})
        if not code:
            raise ValidationError({'code': 'Nhập mã xác thực.'})
        try:
            recruiter = verify_sms_phone_challenge(
                user=request.user,
                public_id=challenge_id,
                code=code,
            )
        except PhoneChallengeError as error:
            raise PhoneChallengeResponse(error) from error
        return Response(RecruiterProfileSerializer(recruiter, context={'request': request}).data)


class AcceptDpaView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Chấp nhận thỏa thuận xử lý dữ liệu cá nhân với ứng viên',
        request=EmployerDpaAcceptanceSerializer,
        responses={200: RecruiterProfileSerializer},
        tags=['employer'],
    )
    def post(self, request):
        serializer = EmployerDpaAcceptanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = request.auth
        auth_session_id = token.get('sid') if hasattr(token, 'get') else None
        try:
            recruiter = accept_recruiter_dpa(
                request.user,
                expected_policy_version=serializer.validated_data['policy_version'],
                expected_document_sha256=serializer.validated_data['document_sha256'],
                ip_address=client_ip(request),
                auth_session_id=auth_session_id,
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )
        except DpaPolicyChanged as error:
            raise DpaPolicyChangedResponse() from error
        except DpaPolicyUnavailable as error:
            raise DpaPolicyUnavailableResponse() from error
        return Response(RecruiterProfileSerializer(recruiter, context={'request': request}).data)

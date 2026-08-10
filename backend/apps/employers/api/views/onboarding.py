from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from common.client_ip import client_ip

from ...models import (
    RecruiterProfile,
)
from ...selectors import has_explicit_company_link
from ...services import (
    DpaPolicyChanged,
    DpaPolicyUnavailable,
    accept_recruiter_dpa,
    get_or_create_recruiter,
    phone_taken_by_other,
    send_phone_otp,
    verify_phone_otp,
)
from ..exceptions import DpaPolicyChangedResponse, DpaPolicyUnavailableResponse
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
    """Kiểm tra nhanh (debounce) xem số điện thoại đã bị NTD khác dùng chưa."""

    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Kiểm tra số điện thoại đã được nhà tuyển dụng khác sử dụng chưa',
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
        if phone_taken_by_other(request.user, phone):
            return Response(
                {
                    'available': False,
                    'detail': 'Đã có nhà tuyển dụng khác sử dụng & xác thực số điện thoại này, '
                    'bạn vui lòng nhập số điện thoại khác và thực hiện lại thao tác.',
                }
            )
        return Response({'available': True})


class SendPhoneOtpView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Gửi mã OTP xác thực số điện thoại (qua email tài khoản)',
        request=inline_serializer(
            'SendPhoneOtp',
            fields={
                'phone': serializers.CharField(required=False),
                'password': serializers.CharField(),
            },
        ),
        responses=inline_serializer(
            'SendPhoneOtpResponse', fields={'detail': serializers.CharField()}
        ),
        tags=['employer'],
    )
    def post(self, request):
        phone = (request.data.get('phone') or request.user.phone or '').strip()
        if not phone:
            raise ValidationError({'phone': 'Nhập số điện thoại cần xác thực.'})
        send_phone_otp(request.user, phone, password=request.data.get('password'))
        return Response({'detail': 'Đã gửi mã xác thực tới email của bạn.'})


class VerifyPhoneOtpView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Xác thực mã OTP số điện thoại',
        request=inline_serializer('VerifyPhoneOtp', fields={'code': serializers.CharField()}),
        responses={200: RecruiterProfileSerializer},
        tags=['employer'],
    )
    def post(self, request):
        code = (request.data.get('code') or '').strip()
        if not code:
            raise ValidationError({'code': 'Nhập mã xác thực.'})
        recruiter = verify_phone_otp(request.user, code)
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

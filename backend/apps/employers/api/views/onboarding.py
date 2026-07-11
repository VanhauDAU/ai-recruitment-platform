from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, parsers, permissions, serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from common.db.search import search_q
from common.media_storage import delete_local_media_url, save_image_upload

from ...models import Company, CompanyDocument, CompanyImage, CompanyUpdateRequest, Industry, RecruiterProfile
from ..serializers import (
    CompanyDocumentSerializer,
    CompanyImageSerializer,
    CompanySearchSerializer,
    CompanySerializer,
    CompanyUpdateRequestSerializer,
    IndustrySerializer,
    RecruiterProfileSerializer,
)
from ...services import get_or_create_recruiter, send_phone_otp, verify_phone_otp

ALLOWED_DOCUMENT_TYPES = {'image/jpeg', 'image/png', 'application/pdf'}


def _require_company(user):
    recruiter = get_or_create_recruiter(user)
    if recruiter.company_id is None:
        raise NotFound('Bạn chưa liên kết với công ty nào.')
    return recruiter


def _require_owner(user):
    recruiter = _require_company(user)
    if recruiter.company_role != RecruiterProfile.CompanyRole.OWNER:
        raise ValidationError({'detail': 'Chỉ người tạo hồ sơ công ty được thực hiện thao tác này.'})
    return recruiter


class RecruiterMeView(generics.RetrieveUpdateAPIView):
    """Hồ sơ nhà tuyển dụng của tôi + trạng thái onboarding 5 bước."""

    serializer_class = RecruiterProfileSerializer
    permission_classes = [IsEmployer]

    def get_object(self):
        return get_or_create_recruiter(self.request.user)


class SendPhoneOtpView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Gửi mã OTP xác thực số điện thoại (qua email tài khoản)',
        request=inline_serializer('SendPhoneOtp', fields={'phone': serializers.CharField(required=False)}),
        responses=inline_serializer('SendPhoneOtpResponse', fields={'detail': serializers.CharField()}),
        tags=['employer'],
    )
    def post(self, request):
        phone = (request.data.get('phone') or request.user.phone or '').strip()
        if not phone:
            raise ValidationError({'phone': 'Nhập số điện thoại cần xác thực.'})
        send_phone_otp(request.user, phone)
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
        request=None,
        responses={200: RecruiterProfileSerializer},
        tags=['employer'],
    )
    def post(self, request):
        recruiter = get_or_create_recruiter(request.user)
        if recruiter.dpa_accepted_at is None:
            recruiter.dpa_accepted_at = timezone.now()
            recruiter.save(update_fields=['dpa_accepted_at', 'updated_at'])
        return Response(RecruiterProfileSerializer(recruiter, context={'request': request}).data)


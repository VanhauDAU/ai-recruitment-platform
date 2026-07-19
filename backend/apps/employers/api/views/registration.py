from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer
from apps.accounts.serializers import SessionUserSerializer
from apps.accounts.services import queue_verification_email, verify_request_captcha
from apps.accounts.services.tokens import issue_tokens
from apps.accounts.services.refresh_cookies import set_refresh_cookie

from ...services.registration import complete_registration_profile, register_employer
from ..serializers import RecruiterProfileSerializer
from ..serializers.registration import EmployerRegisterSerializer, EmployerRegistrationProfileSerializer


class EmployerRegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

    @extend_schema(
        summary='Đăng ký tài khoản và hồ sơ người liên hệ nhà tuyển dụng',
        request=EmployerRegisterSerializer,
        tags=['employer-auth'],
    )
    def post(self, request):
        serializer = EmployerRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verify_request_captcha(request, 'register')
        user, recruiter = register_employer(serializer.validated_data)
        queue_verification_email(user)
        tokens = issue_tokens(user, request, auth_method='registration')
        response = Response(
            {
                'user': SessionUserSerializer(user, context={'request': request}).data,
                'recruiter': RecruiterProfileSerializer(recruiter, context={'request': request}).data,
                'access': tokens['access'],
            },
            status=status.HTTP_201_CREATED,
        )
        return set_refresh_cookie(response, tokens['refresh'], user=user)


class CompleteEmployerRegistrationView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Hoàn tất thông tin bắt buộc sau khi đăng ký nhà tuyển dụng bằng Google',
        request=EmployerRegistrationProfileSerializer,
        responses={200: RecruiterProfileSerializer},
        tags=['employer-auth'],
    )
    def post(self, request):
        serializer = EmployerRegistrationProfileSerializer(
            data=request.data,
            context={'user': request.user},
        )
        serializer.is_valid(raise_exception=True)
        recruiter = complete_registration_profile(request.user, serializer.validated_data)
        return Response(RecruiterProfileSerializer(recruiter, context={'request': request}).data)

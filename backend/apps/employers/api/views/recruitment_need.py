from django.db import IntegrityError
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEmployer

from ...services.profiles import get_or_create_recruiter
from ..serializers import RecruitmentNeedSerializer


class RecruitmentNeedView(APIView):
    permission_classes = [IsEmployer]

    @extend_schema(
        summary='Đọc nhu cầu tuyển dụng ưu tiên trong onboarding',
        responses={200: RecruitmentNeedSerializer},
        tags=['employer-auth'],
    )
    def get(self, request):
        recruiter = get_or_create_recruiter(request.user)
        need = getattr(recruiter, 'recruitment_need', None)
        return Response(RecruitmentNeedSerializer(need).data if need else None)

    @extend_schema(
        summary='Hoàn tất khảo sát nhu cầu tuyển dụng sau xác thực email',
        request=RecruitmentNeedSerializer,
        responses={200: RecruitmentNeedSerializer},
        tags=['employer-auth'],
    )
    def post(self, request):
        recruiter = get_or_create_recruiter(request.user)
        if not request.user.email_verified:
            raise ValidationError({'detail': 'Vui lòng xác thực email trước khi khai báo nhu cầu tuyển dụng.'})
        if recruiter.registration_completed_at is None:
            raise ValidationError({'detail': 'Vui lòng hoàn tất hồ sơ nhà tuyển dụng trước.'})
        if hasattr(recruiter, 'recruitment_need'):
            raise ValidationError({'detail': 'Bạn đã hoàn tất khai báo nhu cầu tuyển dụng.'})
        serializer = RecruitmentNeedSerializer(
            data=request.data,
            context={'recruiter': recruiter},
        )
        serializer.is_valid(raise_exception=True)
        try:
            need = serializer.save()
        except IntegrityError as error:
            raise ValidationError({
                'detail': 'Bạn đã hoàn tất khai báo nhu cầu tuyển dụng.'
            }) from error
        return Response(RecruitmentNeedSerializer(need).data, status=status.HTTP_200_OK)

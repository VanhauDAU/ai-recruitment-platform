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
        need = recruiter.recruitment_needs.order_by('created_at', 'id').first()
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
        if recruiter.recruitment_needs.exists():
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


class RecruitmentNeedListCreateView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        recruiter = get_or_create_recruiter(request.user)
        needs = recruiter.recruitment_needs.select_related('position_category').order_by('-created_at', '-id')
        return Response(RecruitmentNeedSerializer(needs, many=True).data)

    def post(self, request):
        recruiter = get_or_create_recruiter(request.user)
        serializer = RecruitmentNeedSerializer(data=request.data, context={'recruiter': recruiter})
        serializer.is_valid(raise_exception=True)
        return Response(RecruitmentNeedSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)


class RecruitmentNeedDetailView(APIView):
    permission_classes = [IsEmployer]

    def get_object(self, request, public_id):
        recruiter = get_or_create_recruiter(request.user)
        try:
            return recruiter.recruitment_needs.get(public_id=public_id)
        except RecruitmentNeed.DoesNotExist as error:
            raise ValidationError({'detail': 'Không tìm thấy nhu cầu tuyển dụng.'}) from error

    def patch(self, request, public_id):
        serializer = RecruitmentNeedSerializer(self.get_object(request, public_id), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(RecruitmentNeedSerializer(serializer.save()).data)

    def delete(self, request, public_id):
        self.get_object(request, public_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

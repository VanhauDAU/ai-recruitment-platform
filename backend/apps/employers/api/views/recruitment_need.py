from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import IsEmployer

from ...selectors import (
    existing_recruiter_profile,
    recruiter_recruitment_need,
    recruiter_recruitment_needs,
)
from ...services import (
    create_recruitment_need,
    get_or_create_recruiter,
)
from ..serializers import RecruitmentNeedSerializer


@extend_schema_view(
    get=extend_schema(
        summary='Danh sách nhu cầu tuyển dụng của NTD',
        responses={200: RecruitmentNeedSerializer(many=True)},
    ),
    post=extend_schema(
        summary='Tạo nhu cầu tuyển dụng',
        request=RecruitmentNeedSerializer,
        responses={201: RecruitmentNeedSerializer},
    ),
)
@extend_schema(tags=['employer'])
class RecruitmentNeedListCreateView(APIView):
    permission_classes = [IsEmployer]

    def get(self, request):
        recruiter = existing_recruiter_profile(request.user)
        needs = recruiter_recruitment_needs(recruiter) if recruiter else []
        return Response(RecruitmentNeedSerializer(needs, many=True).data)

    def post(self, request):
        recruiter = get_or_create_recruiter(request.user)
        serializer = RecruitmentNeedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        need = create_recruitment_need(
            recruiter=recruiter,
            validated_data=serializer.validated_data,
        )
        return Response(RecruitmentNeedSerializer(need).data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    patch=extend_schema(
        summary='Cập nhật một nhu cầu tuyển dụng',
        request=RecruitmentNeedSerializer,
        responses={200: RecruitmentNeedSerializer},
    ),
    delete=extend_schema(summary='Xóa một nhu cầu tuyển dụng', responses={204: None}),
)
@extend_schema(tags=['employer'])
class RecruitmentNeedDetailView(APIView):
    permission_classes = [IsEmployer]

    def get_object(self, request, public_id):
        recruiter = existing_recruiter_profile(request.user)
        need = recruiter_recruitment_need(recruiter, public_id) if recruiter else None
        if need is None:
            raise ValidationError({'detail': _('Không tìm thấy nhu cầu tuyển dụng.')})
        return need

    def patch(self, request, public_id):
        serializer = RecruitmentNeedSerializer(
            self.get_object(request, public_id), data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        return Response(RecruitmentNeedSerializer(serializer.save()).data)

    def delete(self, request, public_id):
        self.get_object(request, public_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

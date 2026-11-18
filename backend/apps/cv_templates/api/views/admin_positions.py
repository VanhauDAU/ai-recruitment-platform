"""Admin per-position CV configuration: profiles, coverage, JSON import/export and fields."""

from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from ...selectors import admin_position_fields_queryset, admin_position_profiles_queryset
from ...services import coverage_matrix, export_positions, import_positions
from ..serializers.admin_positions import (
    CvPositionFieldAdminSerializer,
    CvPositionProfileAdminSerializer,
)
from .admin_base import ADMIN_TAGS, POSITION_FILTER, AdminModelViewSet


@extend_schema(tags=ADMIN_TAGS)
@extend_schema_view(list=extend_schema(parameters=[POSITION_FILTER]))
class AdminCvPositionViewSet(AdminModelViewSet):
    """Cấu hình CV theo vị trí: bộ section, từ khóa; độ phủ nội dung; import/export JSON."""

    serializer_class = CvPositionProfileAdminSerializer
    lookup_field = 'public_id'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        return admin_position_profiles_queryset(positions=self.request.query_params.get('position'))

    @extend_schema(parameters=[POSITION_FILTER], responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=['get'])
    def coverage(self, request):
        profiles = list(self.get_queryset())
        matrix = coverage_matrix(profiles)
        return Response(
            {
                'results': [
                    {
                        'position_public_id': profile.job_category.public_id,
                        'position_name': profile.job_category.name,
                        'coverage': matrix[profile.pk],
                    }
                    for profile in profiles
                ]
            }
        )

    @extend_schema(parameters=[POSITION_FILTER], responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=['get'])
    def export(self, request):
        return Response(export_positions(self.get_queryset()))

    @extend_schema(request=OpenApiTypes.OBJECT, responses={201: OpenApiTypes.OBJECT})
    @action(detail=False, methods=['post'], url_path='import')
    def import_positions(self, request):
        result = import_positions(payload=request.data, actor=request.user)
        return Response(result, status=status.HTTP_201_CREATED)


@extend_schema(tags=ADMIN_TAGS)
@extend_schema_view(list=extend_schema(parameters=[POSITION_FILTER]))
class AdminCvPositionFieldViewSet(AdminModelViewSet):
    """Trường riêng của vị trí, lọc theo `?position=` (mã `JobCategory`)."""

    serializer_class = CvPositionFieldAdminSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return admin_position_fields_queryset(position=self.request.query_params.get('position'))

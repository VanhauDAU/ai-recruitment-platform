"""Admin starter contents: CRUD, review/publish and AI generation runs."""

from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from common.api.params import parse_int

from ...selectors import admin_sample_contents_queryset, admin_sample_generations_queryset
from ...services import (
    archive_sample,
    estimate_generation_cost,
    publish_sample,
    request_sample_generations,
)
from ..serializers.admin_samples import (
    CvSampleContentAdminSerializer,
    CvSampleGenerationRequestSerializer,
    CvSampleGenerationSerializer,
)
from .admin_base import ADMIN_TAGS, POSITION_FILTER, AdminModelViewSet


@extend_schema(tags=ADMIN_TAGS)
@extend_schema_view(
    list=extend_schema(
        parameters=[
            POSITION_FILTER,
            OpenApiParameter('locale', str),
            OpenApiParameter('band', str),
            OpenApiParameter('status', str),
        ]
    )
)
class AdminCvSampleContentViewSet(AdminModelViewSet):
    serializer_class = CvSampleContentAdminSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return admin_sample_contents_queryset(self.request.query_params)

    @extend_schema(
        request=CvSampleGenerationRequestSerializer, responses={202: OpenApiTypes.OBJECT}
    )
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Xếp hàng sinh nội dung mẫu bằng AI; kết quả vào trạng thái chờ duyệt."""
        serializer = CvSampleGenerationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        generations = request_sample_generations(
            actor=request.user,
            profiles=data['position_public_ids'],
            locales=sorted(data['locales']),
            bands=sorted(data['experience_bands']),
        )
        return Response(
            {
                'batch_id': generations[0].batch_id,
                'generations': CvSampleGenerationSerializer(generations, many=True).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @extend_schema(request=None, responses={200: CvSampleContentAdminSerializer})
    @action(detail=True, methods=['post'])
    def publish(self, request, public_id=None):
        sample = publish_sample(sample=self.get_object(), actor=request.user)
        return Response(self.get_serializer(sample).data)

    @extend_schema(request=None, responses={200: CvSampleContentAdminSerializer})
    @action(detail=True, methods=['post'])
    def archive(self, request, public_id=None):
        sample = archive_sample(sample=self.get_object())
        return Response(self.get_serializer(sample).data)


@extend_schema(tags=ADMIN_TAGS)
@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter('batch', str)]))
class AdminCvSampleGenerationViewSet(AdminModelViewSet):
    """Trạng thái các lượt sinh AI, lọc theo `?batch=`; chỉ đọc."""

    serializer_class = CvSampleGenerationSerializer
    lookup_field = 'public_id'
    http_method_names = ['get', 'head', 'options']

    @extend_schema(
        parameters=[OpenApiParameter('count', int)], responses={200: OpenApiTypes.OBJECT}
    )
    @action(detail=False, methods=['get'])
    def estimate(self, request):
        """Chi phí ước tính cho `count` lượt, theo trung bình các lượt thành công gần đây."""
        count = parse_int(request.query_params.get('count', 1))
        if count is None:
            raise ValidationError({'count': 'Phải là số.'})
        return Response(estimate_generation_cost(count))

    def get_queryset(self):
        return admin_sample_generations_queryset(batch=self.request.query_params.get('batch'))

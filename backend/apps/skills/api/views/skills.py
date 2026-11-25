from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from apps.accounts.api.permissions import IsEmployer
from common.api.throttling import WriteScopedRateThrottle, with_default_throttles

from ...models import Skill
from ...selectors import active_skill_groups_queryset, skill_lookup_queryset
from ...services import create_skill
from ..serializers import SkillCreateSerializer, SkillGroupSerializer, SkillSerializer


@extend_schema(summary='Nhóm kỹ năng đang hoạt động', tags=['skills'])
class SkillGroupListView(generics.ListAPIView):
    serializer_class = SkillGroupSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = active_skill_groups_queryset()


@extend_schema_view(
    get=extend_schema(
        summary='Tra cứu kỹ năng (tối đa 100 kết quả)',
        parameters=[
            OpenApiParameter('group', int, description='Lọc theo id nhóm kỹ năng'),
            OpenApiParameter('search', str, description='Tìm theo tên'),
        ],
    ),
    post=extend_schema(
        summary='NTD thêm kỹ năng mới (trả kỹ năng sẵn có nếu trùng tên)',
        request=SkillCreateSerializer,
        responses={200: SkillSerializer, 201: SkillSerializer},
    ),
)
@extend_schema(tags=['skills'])
class SkillListView(generics.ListCreateAPIView):
    throttle_classes = with_default_throttles(WriteScopedRateThrottle)
    throttle_scope = 'skill_create'
    serializer_class = SkillSerializer
    pagination_class = None

    def get_permissions(self):
        permission_class = IsEmployer if self.request.method == 'POST' else permissions.AllowAny
        return [permission_class()]

    def get_queryset(self):
        return skill_lookup_queryset(self.request.query_params)

    def create(self, request, *args, **kwargs):
        input_serializer = SkillCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        skill, created = create_skill(
            input_serializer.validated_data['name'], source=Skill.Source.EMPLOYER
        )
        return Response(
            SkillSerializer(skill).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

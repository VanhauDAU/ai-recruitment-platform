"""API quản trị danh mục kỹ năng và nhóm kỹ năng."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission
from common.api.pagination import StandardPagination

from ...models import Skill, merge_preview
from ...selectors import (
    admin_skill_groups_queryset,
    admin_skill_summary,
    admin_skills_queryset,
    with_usage,
)
from ...services import (
    bulk_update_skills,
    create_admin_skill,
    merge_skills,
    save_skill_group,
    update_skill,
)
from ..serializers import (
    AdminSkillGroupSerializer,
    AdminSkillSerializer,
    SkillBulkUpdateSerializer,
    SkillGroupWriteSerializer,
    SkillMergePreviewSerializer,
    SkillMergeSerializer,
    SkillSummarySerializer,
    SkillWriteSerializer,
)

TAGS = ['skills-admin']
LIST_PARAMETERS = [
    OpenApiParameter('search', str, description='Tìm theo tên hoặc tên gọi khác'),
    OpenApiParameter('group', int, description='Id nhóm kỹ năng'),
    OpenApiParameter('ungrouped', bool, description='Chỉ kỹ năng chưa có nhóm'),
    OpenApiParameter('source', str, enum=Skill.Source.values),
    OpenApiParameter('is_active', bool),
    OpenApiParameter('duplicates', bool, description='Chỉ kỹ năng có thể trùng nhau'),
    OpenApiParameter('ordering', str, enum=['name', 'recent', 'usage']),
]


class AdminSkillPagination(StandardPagination):
    page_size = 50


def _skill_response(skill, response_status=status.HTTP_200_OK):
    skill = with_usage(Skill.objects.select_related('group')).get(pk=skill.pk)
    return Response(AdminSkillSerializer(skill).data, status=response_status)


@extend_schema(tags=TAGS)
@extend_schema_view(
    list=extend_schema(parameters=LIST_PARAMETERS),
    create=extend_schema(request=SkillWriteSerializer, responses={201: AdminSkillSerializer}),
    partial_update=extend_schema(
        request=SkillWriteSerializer, responses={200: AdminSkillSerializer}
    ),
)
class AdminSkillViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [AdminPortalPermission]
    # Gộp xóa hẳn kỹ năng nguồn và không hoàn tác được.
    require_superuser = {'actions': {'merge'}}
    serializer_class = AdminSkillSerializer
    pagination_class = AdminSkillPagination
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    lookup_value_regex = r'\d+'

    def get_queryset(self):
        return admin_skills_queryset(self.request.query_params)

    def get_object(self):
        return get_object_or_404(Skill, pk=self.kwargs['pk'])

    def create(self, request, *args, **kwargs):
        serializer = SkillWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        skill = create_admin_skill(actor=request.user, **serializer.validated_data)
        return _skill_response(skill, status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        serializer = SkillWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        skill = update_skill(
            actor=request.user, skill=self.get_object(), **serializer.validated_data
        )
        return _skill_response(skill)

    @extend_schema(responses=SkillSummarySerializer)
    @action(detail=False, methods=['get'])
    def summary(self, request):
        return Response(SkillSummarySerializer(admin_skill_summary()).data)

    @extend_schema(request=SkillBulkUpdateSerializer, responses={200: SkillSummarySerializer})
    @action(detail=False, methods=['post'], url_path='bulk-update')
    def bulk_update(self, request):
        serializer = SkillBulkUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        skills = list(Skill.objects.filter(pk__in=data.pop('ids')))
        bulk_update_skills(actor=request.user, skills=skills, **data)
        return Response(SkillSummarySerializer(admin_skill_summary()).data)

    @extend_schema(
        parameters=[OpenApiParameter('target', int, required=True)],
        responses=SkillMergePreviewSerializer,
    )
    @action(detail=True, methods=['get'], url_path='merge-preview')
    def merge_preview(self, request, pk=None):
        serializer = SkillMergeSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        preview = merge_preview(self.get_object(), serializer.validated_data['target'])
        return Response(SkillMergePreviewSerializer(preview).data)

    @extend_schema(request=SkillMergeSerializer, responses={200: AdminSkillSerializer})
    @action(detail=True, methods=['post'])
    def merge(self, request, pk=None):
        serializer = SkillMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = merge_skills(
            actor=request.user,
            source=self.get_object(),
            target=serializer.validated_data['target'],
        )
        return _skill_response(target)


@extend_schema(tags=TAGS)
@extend_schema_view(
    create=extend_schema(
        request=SkillGroupWriteSerializer, responses={201: AdminSkillGroupSerializer}
    ),
    partial_update=extend_schema(
        request=SkillGroupWriteSerializer, responses={200: AdminSkillGroupSerializer}
    ),
)
class AdminSkillGroupViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [AdminPortalPermission]
    serializer_class = AdminSkillGroupSerializer
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    lookup_value_regex = r'\d+'

    def get_queryset(self):
        return admin_skill_groups_queryset().order_by('name')

    def _respond(self, group, response_status=status.HTTP_200_OK):
        group = self.get_queryset().get(pk=group.pk)
        return Response(AdminSkillGroupSerializer(group).data, status=response_status)

    def create(self, request, *args, **kwargs):
        serializer = SkillGroupWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = save_skill_group(actor=request.user, **serializer.validated_data)
        return self._respond(group, status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        serializer = SkillGroupWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        group = save_skill_group(
            actor=request.user, group=self.get_object(), **serializer.validated_data
        )
        return self._respond(group)

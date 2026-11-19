from drf_spectacular.utils import (
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission

from ...selectors import admin_company_content_changes_queryset, content_change_labels
from ...services import mark_company_content_changes_reviewed, revert_company_content_change
from ..serializers import (
    AdminCompanyContentChangeSerializer,
    AdminContentChangeRevertSerializer,
    AdminContentChangeReviewSerializer,
)

LIST_PARAMETERS = [
    OpenApiParameter(
        'status',
        str,
        enum=['unreviewed', 'reviewed', 'reverted', 'all'],
        description='Mặc định `unreviewed`',
    ),
    OpenApiParameter('company', str, description='public_id của công ty'),
    OpenApiParameter('q', str, description='Tên công ty hoặc email người sửa'),
]


@extend_schema_view(
    list=extend_schema(
        summary='Thay đổi nội dung trang công ty đã đăng, chờ hậu kiểm',
        parameters=LIST_PARAMETERS,
    ),
    retrieve=extend_schema(summary='Chi tiết một thay đổi nội dung trang công ty'),
)
class AdminCompanyContentChangeViewSet(viewsets.ReadOnlyModelViewSet):
    """Page content published by editors, for review after the fact."""

    permission_classes = [AdminPortalPermission]
    serializer_class = AdminCompanyContentChangeSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        params = self.request.query_params if self.action == 'list' else {'status': 'all'}
        return admin_company_content_changes_queryset(params=params)

    def get_serializer(self, *args, **kwargs):
        rows = list(args[0]) if kwargs.get('many') else list(args[:1])
        kwargs.setdefault('context', self.get_serializer_context())
        kwargs['context']['labels'] = content_change_labels(rows)
        return super().get_serializer(*args, **kwargs)

    @extend_schema(
        summary='Đánh dấu đã xem các thay đổi nội dung',
        request=AdminContentChangeReviewSerializer,
        responses={
            200: inline_serializer(
                'AdminContentChangeReviewResult', fields={'count': serializers.IntegerField()}
            )
        },
    )
    @action(detail=False, methods=['post'], url_path='mark-reviewed')
    def mark_reviewed(self, request):
        serializer = AdminContentChangeReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = mark_company_content_changes_reviewed(
            actor=request.user, public_ids=serializer.validated_data['public_ids']
        )
        return Response({'count': count})

    @extend_schema(
        summary='Hoàn tác một thay đổi nội dung và báo lý do cho người sửa',
        request=AdminContentChangeRevertSerializer,
        responses={200: AdminCompanyContentChangeSerializer},
    )
    @action(detail=True, methods=['post'])
    def revert(self, request, public_id=None):
        serializer = AdminContentChangeRevertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        revert_company_content_change(
            actor=request.user, public_id=public_id, **serializer.validated_data
        )
        return Response(self.get_serializer(self.get_object()).data)

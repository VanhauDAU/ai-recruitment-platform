"""CV ứng viên cho admin (CVT-4): metadata, xem nội dung có lý do, khóa CV vi phạm."""

from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission

from ...selectors import admin_cvs_queryset
from ...services import admin_cv_content, lock_cv, unlock_cv
from ..serializers.admin import AdminCvReasonSerializer, AdminUserCvSerializer


@extend_schema(tags=['cvs-admin'])
@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter('template', str),
            OpenApiParameter('source', str),
            OpenApiParameter('language', str),
            OpenApiParameter('status', str),
            OpenApiParameter('import_failed', bool),
            OpenApiParameter('locked', bool),
            OpenApiParameter('q', str, description='Mã CV hoặc mã người dùng'),
        ]
    )
)
class AdminUserCvViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AdminPortalPermission]
    serializer_class = AdminUserCvSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return admin_cvs_queryset(self.request.query_params)

    def _reason(self, request):
        serializer = AdminCvReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data['reason']

    @extend_schema(request=AdminCvReasonSerializer, responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=['post'])
    def content(self, request, public_id=None):
        """Nội dung phiên bản mới nhất; mỗi lần xem ghi nhật ký kèm lý do."""
        cv = self.get_object()
        version = admin_cv_content(
            cv=cv,
            actor=request.user,
            reason=self._reason(request),
            request=request,
        )
        response = Response(
            {
                'version_public_id': version.public_id,
                'renderer_key': version.template_version.renderer_key
                if version.template_version
                else '',
                'document': {
                    'schema_version': version.schema_version,
                    'content_json': version.content_json,
                    'layout_json': version.layout_json,
                    'style_json': version.style_json,
                },
            }
        )
        response['Cache-Control'] = 'private, no-store'
        return response

    @extend_schema(request=AdminCvReasonSerializer, responses={200: AdminUserCvSerializer})
    @action(detail=True, methods=['post'])
    def lock(self, request, public_id=None):
        cv = lock_cv(cv=self.get_object(), actor=request.user, reason=self._reason(request))
        return Response(self.get_serializer(self.get_queryset().get(pk=cv.pk)).data)

    @extend_schema(request=None, responses={200: AdminUserCvSerializer})
    @action(detail=True, methods=['post'])
    def unlock(self, request, public_id=None):
        cv = unlock_cv(cv=self.get_object())
        return Response(self.get_serializer(self.get_queryset().get(pk=cv.pk)).data)

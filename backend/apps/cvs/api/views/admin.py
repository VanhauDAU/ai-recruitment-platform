"""CV ứng viên cho admin (CVT-4): metadata, xem nội dung có lý do, khóa CV vi phạm."""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import HasAdminPermission
from common.pagination import StandardPagination

from ...selectors import admin_cvs_queryset
from ...services import admin_cv_content, lock_cv, unlock_cv
from ..serializers.admin import AdminCvReasonSerializer, AdminUserCvSerializer


class AdminUserCvViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasAdminPermission]
    pagination_class = StandardPagination
    serializer_class = AdminUserCvSerializer
    lookup_field = 'public_id'
    required_admin_permissions = {
        'list': ['cv_user.view'],
        'retrieve': ['cv_user.view'],
        'content': ['cv_user.view_content'],
        'lock': ['cv_user.view_content'],
        'unlock': ['cv_user.view_content'],
    }

    def get_queryset(self):
        return admin_cvs_queryset(self.request.query_params)

    def _reason(self, request):
        serializer = AdminCvReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data['reason']

    def _call(self, service, **kwargs):
        try:
            return service(**kwargs)
        except DjangoValidationError as error:
            raise ValidationError(error.message_dict) from error

    @action(detail=True, methods=['post'])
    def content(self, request, public_id=None):
        """Nội dung phiên bản mới nhất; mỗi lần xem ghi nhật ký kèm lý do."""
        cv = self.get_object()
        version = self._call(
            admin_cv_content,
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

    @action(detail=True, methods=['post'])
    def lock(self, request, public_id=None):
        cv = self._call(
            lock_cv, cv=self.get_object(), actor=request.user, reason=self._reason(request)
        )
        return Response(self.get_serializer(self.get_queryset().get(pk=cv.pk)).data)

    @action(detail=True, methods=['post'])
    def unlock(self, request, public_id=None):
        cv = self._call(unlock_cv, cv=self.get_object())
        return Response(self.get_serializer(self.get_queryset().get(pk=cv.pk)).data)

from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, viewsets

from apps.accounts.api.permissions import AdminPortalPermission, require_superuser

from ...selectors import audit_logs_queryset
from ..serializers.admin_audit import AdminAuditLogSerializer


@extend_schema_view(
    list=extend_schema(
        summary='Nhật ký hoạt động quản trị',
        parameters=[
            OpenApiParameter('scope', str, enum=['all'], description='all: toàn hệ thống'),
            OpenApiParameter('action', str),
            OpenApiParameter('target_type', str),
        ],
    )
)
class AdminAuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Nhật ký hoạt động cho trang Cài đặt tài khoản.

    Mặc định chỉ trả log của chính người gọi nên mọi quản trị viên đều xem được.
    ``?scope=all`` mở rộng ra toàn hệ thống và chỉ dành cho superuser.
    """

    permission_classes = [AdminPortalPermission]
    serializer_class = AdminAuditLogSerializer

    def get_queryset(self):
        params = self.request.query_params
        scope_is_all = params.get('scope') == 'all'
        if scope_is_all:
            require_superuser(self.request.user)
        return audit_logs_queryset(
            actor=None if scope_is_all else self.request.user,
            action=params.get('action', '').strip(),
            target_type=params.get('target_type', '').strip(),
        )

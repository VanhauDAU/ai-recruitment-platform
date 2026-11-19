from django.utils.translation import gettext as _
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.api.permissions import AdminPortalPermission

from ...selectors import admin_company_join_requests_queryset
from ...services import decide_company_join
from ..serializers.join_requests import AdminCompanyJoinRequestSerializer


@extend_schema_view(
    list=extend_schema(summary='Yêu cầu tham gia công ty trên toàn hệ thống'),
    retrieve=extend_schema(summary='Chi tiết yêu cầu tham gia công ty'),
)
class AdminCompanyJoinRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Join requests across companies; administrators decide only those without an owner."""

    permission_classes = [AdminPortalPermission]
    serializer_class = AdminCompanyJoinRequestSerializer
    lookup_field = 'public_id'

    def get_queryset(self):
        return admin_company_join_requests_queryset(params=self.request.query_params)

    @extend_schema(
        summary='Duyệt hoặc từ chối yêu cầu tham gia công ty chưa có owner',
        parameters=[
            OpenApiParameter('decision', str, OpenApiParameter.PATH, enum=['approve', 'reject'])
        ],
        request=None,
        responses={200: AdminCompanyJoinRequestSerializer},
    )
    @action(detail=True, methods=['post'], url_path=r'(?P<decision>approve|reject)')
    def decide(self, request, public_id=None, decision=None):
        if decision not in {'approve', 'reject'}:
            raise ValidationError({'decision': _('Chỉ chấp nhận approve hoặc reject.')})
        join_request = decide_company_join(request.user, public_id, approve=decision == 'approve')
        return Response(AdminCompanyJoinRequestSerializer(join_request).data)
